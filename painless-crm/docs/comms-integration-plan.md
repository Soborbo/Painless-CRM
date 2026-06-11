# Communications integráció terv — WhatsApp + LiveSwitch + (két­irányú) e-mail

> Státusz: **TERVEZET — jóváhagyásra**. Kód még nem készült.
> Cél: a WhatsApp, a LiveSwitch (videós felmérés) és a két­irányú e-mail
> bekötése a meglévő Communications Hub (Phase 13) alapokra.

## 0. Vezérelv

Minden csatorna ugyanabba a `messages` táblába ír (kimenő és bejövő egyaránt),
így a customer/job idővonalon egységesen jelenik meg. A motor (`automation_rules`
→ `automation_queue` → 60 mp-es cron) és a token-tár (`integration_credentials`,
titkosítva, cégenként) már létezik — ezekre építünk, nem mellettük.

## 1. Mi van már kész (nem építjük újra)

| Elem | Hol | Állapot |
|---|---|---|
| `messages` egységes inbox (`channel: email/sms/whatsapp/phone`, `direction`, `thread_id`, `provider_message_id`) | `migrations/…phase_02` | séma kész |
| `whatsapp_templates` / `sms_templates` / `email_templates` | ua. | séma kész |
| `automation_rules` (`send_email/send_sms/send_whatsapp/webhook`) + `automation_queue` + cron | `src/lib/comms/automation-cron.ts`, `src/app/api/cron/automation-queue` | email él; sms/whatsapp ma „skipped" |
| `phone_calls` (`source: tamar_email/tamar_api/manual`) | `migrations/…phase_02` | séma kész |
| `integration_credentials` (provider enumban már: `meta_whatsapp`, `liveswitch`, `tamar_telecom`, `resend`) | ua. | séma kész |
| `webhook_events` idempotencia (`unique(source,event_id)`) | ua. + `src/lib/webhooks/handler.ts` | kész |
| `consent` (`marketing_email/sms/whatsapp`) | ua. | séma kész |
| Resend kimenő senderek + `safeSend` mintázat | `src/lib/integrations/resend/` | kész |

## 2. Megvalósítási sorrend (fázisok)

A választott prioritás: **WhatsApp először**, majd LiveSwitch (videós felmérés),
végül a bejövő e-mail. A 0. fázis (közös send-réteg) minden továbbinak alapja.

### Fázis A — Közös send-réteg + a cron WhatsApp/SMS ága

**Cél:** egy `sendMessage()` belépési pont, ami csatornától függetlenül a
`messages` táblába logol, és amit a cron + a kézi „küldés" gomb is hív.

- Új: `src/lib/comms/send.ts` — `sendMessage({ companyId, customerId, jobId, channel, to, templateId, vars })`.
  - Csatorna szerint a megfelelő provider-sendert hívja.
  - A `safeSend` mintát követi: a provider-hibát visszaadja, nem dobja; a
    `messages.status`-t ennek megfelelően állítja (`sent` / `failed` / `queued`).
  - Mindig beír egy `messages` sort (`direction: 'outbound'`,
    `provider_message_id`-vel ha van).
- `src/lib/comms/automation-cron.ts`: a jelenlegi `rule.action_type !== 'send_email'`
  korai kilépés helyett kapcsoló a `send_email` / `send_sms` / `send_whatsapp`
  ágakra, mindegyik a `sendMessage()`-en keresztül. A dwell-guard (ADR-024) és a
  company-scope-olt template-olvasás (audit M3) változatlan marad.
- A `whatsapp_templates` változó-feloldása ugyanazt a `renderTemplate` +
  `buildTemplateVars` utat használja, mint az e-mail.

**Megjegyzés a sablonokról:** a Meta jóváhagyott sablon-neveket és `components`
paramétereket vár, nem szabad szöveget. A `whatsapp_templates` sorban tárolni
kell a Meta-oldali `template_name` + `language` + a változó-pozíciókat; a
`renderTemplate` itt a **paraméter-értékeket** állítja elő, nem a teljes szöveget.

### Fázis B — WhatsApp (Meta WhatsApp Cloud API)

**Kimenő:**
- Új: `src/lib/integrations/meta-whatsapp/send.ts` (`safe-send.ts` mintára).
  - Endpoint: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`.
  - A 24 órás ügyfél-ablakon **kívül csak jóváhagyott `template` üzenet** mehet;
    az ablakon belül szabad szöveg is. A send-réteg ezt eldönti a `messages`
    utolsó inbound `sent_at`-je alapján (24h ablak-számítás).
  - Token + `phone_number_id` az `integration_credentials`-ből
    (`provider='meta_whatsapp'`), a meglévő titkosított olvasó úton.

**Bejövő:**
- Új: `src/app/api/webhooks/meta-whatsapp/route.ts`.
  - **GET**: Meta verifikációs challenge — `hub.mode`/`hub.verify_token`/`hub.challenge`.
    A `verify_token` env-ből (`META_WHATSAPP_VERIFY_TOKEN`).
  - **POST**: aláírás-ellenőrzés `X-Hub-Signature-256` az **app secret**-tel
    (HMAC-SHA256 a nyers body felett) — a `timingSafeEqual`/`computeHmacSha256Hex`
    segédek újrahasználva. **Nem** a CRM-belső `createWebhookHandler` sémája,
    mert a Meta saját aláírást küld.
  - Dedup a `webhook_events`-be (`source='meta_whatsapp'`, `event_id` = a Meta
    `messages[].id`).
  - Üzenet-párosítás telefonszám alapján `customers`-hez (E.164 normalizálás);
    ha nincs találat → új lead/„unmatched" kezelés (lásd nyitott kérdés).
  - Beír `messages` sort (`direction: 'inbound'`, `channel: 'whatsapp'`,
    `thread_id` az ügyfél korábbi szálához kötve), majd `notifications`-on
    értesíti a felelős repet.
  - A státusz-eseményeket (`sent/delivered/read/failed`) a kimenő `messages` sor
    `delivered_at`/`status` mezőire vezeti vissza `provider_message_id` alapján.

**Üzemeltetés / kritikus út:** a Meta template-approval 1–2 hét, ezért a sablonok
beadása a Meta Business Managerben **az A fázissal párhuzamosan, azonnal**
induljon (spec döntés is).

### Fázis C — LiveSwitch (videós felmérés)

**Cél:** virtuális lakásfelmérés árajánlathoz — meghívó-link az ügyfélnek, a
felvétel/eredmény a job-hoz csatolva.

- Token: `integration_credentials` `provider='liveswitch'`.
- **Kimenő (meghívó):** új `src/lib/integrations/liveswitch/invite.ts` —
  a job/customer kártyán „Videós felmérés meghívása" akció létrehoz egy
  LiveSwitch meeting/contact-linket, amit a meglévő csatornákon (WhatsApp / SMS /
  e-mail) kiküldünk a `sendMessage()`-en át, és `messages`-be logolunk. A meghívó
  linket a `jobs.survey_*` mezőkhöz / egy `messages` sorhoz kötjük.
- **Bejövő (esemény-webhook):** új `src/app/api/webhooks/liveswitch/route.ts` —
  LiveSwitch aláírás-séma szerinti ellenőrzés, `webhook_events` dedup
  (`source='liveswitch'`). Eseménytípusok: meghívó megnyitva, hívás indult,
  hívás véget ért, felvétel kész.
  - A hívás-eseményt a **`phone_calls`** táblába írjuk (időtartam, `recording_url`),
    és a `source` check-constraintet kiegészítjük `'liveswitch'` értékkel
    (kis migráció).
  - Így a videós felmérés ugyanúgy megjelenik az ügyfél idővonalán, mint egy hívás,
    és a `survey` workflow-hoz kapcsolható.

### Fázis D — Két­irányú e-mail (bejövő) + Tamar hívás-parse

- **Bejövő e-mail:** Resend Inbound **vagy** Cloudflare Email Workers egy
  `crm@…` címre. Parse → `messages` (`direction: 'inbound'`, `channel: 'email'`,
  `thread_id` az `In-Reply-To`/`References` alapján), ügyfél-párosítás
  e-mail-cím szerint.
- **Tamar hívás-értesítő parse:** a `crm-calls@…` címre érkező Tamar e-mailből
  (caller, called, duration, occurred_at, recording) → `phone_calls`
  (`source='tamar_email'`), rep értesítése. (Spec Phase 13 §7.)
- Mindkettő a már létező webhook-mintát követi; az aláírás itt a Resend Inbound /
  CF Email Worker sémája.

### Fázis E — Egységes inbox UI

- A customer/job kártyán egy „Beszélgetések" panel a `messages`-ből
  (`customer_id`/`job_id`/`thread_id` már indexelt), csatorna-ikonokkal és
  kétirányú szállal; válasz-mező, ami a `sendMessage()`-et hívja.
- Konszenzus-érvényesítés (`consent`) a marketing jellegű kimenő üzeneteknél.

## 3. Új env-kulcsok (mind opcionális, `serverEnv` séma bővítés)

```
# Meta WhatsApp Cloud API
META_WHATSAPP_APP_SECRET=          # X-Hub-Signature-256 ellenőrzéshez
META_WHATSAPP_VERIFY_TOKEN=        # GET challenge
# (token + phone_number_id: integration_credentials-ben, nem env-ben)

# LiveSwitch
LIVESWITCH_WEBHOOK_SECRET=         # bejövő esemény-aláíráshoz
# (API token: integration_credentials-ben)

# Bejövő e-mail (Resend Inbound vagy CF Email Worker — a választott úttól függ)
```

A provider-tokenek **nem** env-be, hanem az `integration_credentials` titkosított
tárba kerülnek (cégenként, audit-loggal) — ez a meglévő minta.

## 4. Migrációk (kicsik, additívak)

1. `phone_calls.source` check-constraint kiegészítése `'liveswitch'`-csel.
2. (Opcionális) `messages.channel`-höz `'whatsapp'` már létezik — nincs teendő.
3. (Opcionális) index a `messages(provider, provider_message_id)`-re a bejövő
   státusz-visszavezetéshez.

A `integration_credentials.provider` enum már tartalmazza mindhárom providert —
ott nincs migráció.

## 5. Tesztelés

- Egységteszt: `sendMessage()` csatorna-routing + `messages` insert alakja
  (vitest, a meglévő `automation.test` minta).
- Webhook-tesztek: aláírás-ellenőrzés (érvényes/érvénytelen/replay), dedup,
  ügyfél-párosítás, inbound `messages` insert.
- A `safeSend`-szerű „provider rejection → failed, nem dobás" út lefedése.

## 6. Nyitott kérdések (jóváhagyáshoz)

1. **Ismeretlen feladó** WhatsApp/email esetén: új lead automatikus létrehozása,
   vagy „unmatched" várólista kézi párosításra?
2. **SMS** kell-e egyáltalán (Twilio), vagy elég a WhatsApp + e-mail? (A séma
   támogatja, de a választott scope WhatsApp-ra fókuszál.)
3. **Bejövő e-mail útja:** Resend Inbound vs. Cloudflare Email Workers
   (a deploy Cloudflare Workers-en fut — a CF Email Worker natívabb lehet).
4. **LiveSwitch termék:** Contact (videós felmérés) elég, vagy a hívás-napló
   (Concierge) funkció is kell a Tamar mellé?
