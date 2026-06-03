-- Local-dev seed. Auth users are created via the Supabase Studio UI or
-- supabase CLI (`supabase auth users create`); only profile rows go here.
-- Replace the uuids below with the auth.users.id values produced by the CLI.

-- Example (uncomment after creating the auth users):
-- insert into public.users (auth_id, company_id, email, full_name, role) values
--   ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
--    'laszlo@soborbo.com', 'Laszlo (Soborbo)', 'super_admin'),
--   ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
--    'jay@painlessremovals.com', 'Jay Newton', 'admin'),
--   ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
--    'tom@painlessremovals.com', 'Tom', 'sales'),
--   ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001',
--    'tamara@painlessremovals.com', 'Tamara', 'sales'),
--   ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001',
--    'surveyor@painlessremovals.com', 'Surveyor', 'surveyor'),
--   ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001',
--    'loader@painlessremovals.com', 'Loader', 'loader'),
--   ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001',
--    'accounts@painlessremovals.com', 'Accountant', 'accounts')
-- on conflict (auth_id) do nothing;

-- ============================================================
-- Transactional email templates + automation rules (Phase 13b)
-- ============================================================
-- Jay's iMVE transactional templates (painless-crm-spec/EMAIL_TEMPLATES.md),
-- migrated into the Comms Hub. Bodies use {{merge}} placeholders rendered by
-- lib/comms/template-vars + render. Dollar-quoted ($t$) so apostrophes need no
-- escaping. For production these same inserts are applied as a Phase-17 cutover
-- step (MIGRATION_MAPPING.md §11). Tenant = the seeded Painless company.

insert into email_templates (id, company_id, name, category, subject_template, body_template, active) values
('0e3b13b0-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome email', 'lead', $t$Let's make your removal Painless!$t$, $t$Dear {{first_name}},

Thanks for reaching out to us about your move—let's get the ball rolling!

Not done an instant quote yet?
No worries—it only takes 47 seconds (seriously, we timed it). Pop over to: painlessremovals.com/instantquote

Already got your instant quote?
Awesome! The quickest way to get your official quote is by doing our self-survey video tour. Simply head to: painlessremovals.com/self-survey

There you'll find all the info you need and can upload a video walk-through of your home at your convenience.

If uploading a video feels like a bit too much, don't worry—our team will give you a ring soon to help in any way we can or to book a home visit.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Survey Request', 'survey', $t$Survey request {{job_number}}$t$, $t$Hi {{first_name}},

Thanks for taking a look at our pricing calculator — I hope it's been helpful in giving you a rough idea of costs.

Just so you know, the figures from the calculator are based on averages, so they can sometimes come out slightly high or low depending on the exact details of your move.

When you're ready to take things a step further, the next step is a quick survey so we can confirm the volume and provide a fixed, accurate quote.

You've got three easy options:

Video Self-Survey
Film a short walkthrough in your own time (usually 5–10 minutes): painlessremovals.com/self-survey

Video Call Survey
A live video call with one of our team (usually 10–15 minutes), where we guide you through the process and ask any questions as we go.

Home Visit
If you're local to Bristol, we can arrange a visit — usually around 30 minutes. Ideal for larger or more complex moves.

There's absolutely no pressure — whether you're just exploring options or ready to book, feel free to reply to this email or give us a call if you'd like to arrange a survey or chat things through.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Survey request – video', 'survey', $t$Survey request {{job_number}}$t$, $t$Hi {{first_name}},

Thanks for taking a look at our pricing calculator — I hope it's been helpful in giving you a rough idea of costs.

Just so you know, the figures from the calculator are based on averages, so they can sometimes come out slightly high or low depending on the exact details of your move.

When you're ready to take things a step further, the next step is a quick survey so we can confirm the volume and provide a fixed, accurate quote.

You've got two easy options:

Video Self-Survey
Film a short walkthrough in your own time (usually 5–10 minutes): painlessremovals.com/self-survey

Video Call Survey
A live video call with one of our team (usually 10–15 minutes), where we guide you through the process and ask any questions as we go.

There's absolutely no pressure — whether you're just exploring options or ready to book, feel free to reply to this email or give us a call if you'd like to arrange a survey or chat things through.

Warm regards,
Tom Mallett
Painless Removals Ltd
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Photos & List Required', 'quote', $t$Photos & List Required {{job_number}}$t$, $t$Dear {{first_name}},

Thank you for contacting {{company_name}} regarding your upcoming move.

Moving from..
{{current_address}}

Moving to…
{{new_address}}

Please send a list/photos to this email address, and we will quote you immediately.

Please do not hesitate to contact us if you require any further information.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Survey Confirmation', 'survey', $t$Confirmation survey {{job_number}}$t$, $t$Dear {{first_name}},

Thank you for contacting {{company_name}} regarding your upcoming move. We have booked your home visit for {{booked_date}} at {{booked_time}}

Moving from
{{current_address}}

Moving to
{{new_address}}

Please do not hesitate to contact us if you require any further information.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Quotation', 'quote', $t$Painless Removals quote {{job_number}}$t$, $t$Hi {{first_name}},

Thanks for getting in touch about your move! We've put together a fully tailored quote for you—attached to this email.

You can accept or decline it easily by clicking the link in the attachment. If you accept, we'll give you a call to go over the details and get everything booked in.

If you choose Painless Removals, you'll have complete peace of mind. We're fully insured, and when we book your move, that day is dedicated to you—no other jobs. You'll have our full attention, and if anything comes up on the day, we'll be there to handle it. That's how we keep things quick, efficient, safe—and painless.

Please review our terms and conditions before accepting the quote.
Any questions? Just give us a ring or drop us an email—we're happy to help.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Waste Clearance quote', 'quote', $t$Your waste clearance quote {{job_number}}$t$, $t$Dear {{first_name}},

Thanks for getting in touch about your clearance! We've put together a tailored quote for you—attached to this email.

You can accept or decline it easily by clicking the link in the attachment. If you accept, we'll give you a call to go over the details and get everything booked in.

At Painless Removals, we're committed to doing things properly. That means clearing your items quickly and efficiently—but also ethically. We recycle or reuse as much as possible, only taking items to the tip as a last resort. It's our way of doing our part for the planet while giving you a reliable, stress-free service.

If you have any questions about the quote or what we can and can't take, just give us a ring or drop us an email—we're always happy to help.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Follow up after quotation', 'quote_followup', $t$Follow up after quotation {{job_number}}$t$, $t$Dear {{first_name}},

I hope you're well. We recently sent you a quote for your upcoming move, but haven't heard back yet. Is there anything else we can help with? Would you like me to check availability for you?

If you need to update any details or have any questions, feel free to give us a call on 0117 2870082 or reply to this email.

We're here if you need us and hope to hear from you soon.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Yet to hear from you', 'quote_followup', $t$Painless Removals {{job_number}}$t$, $t$Hi {{first_name}},

Thanks for your earlier inquiry. We have yet to hear back from you regarding your interest in booking our services. Our diary for the next few weeks is filling up, and if you'd like to reserve your move with us, we'd recommend booking your date sooner rather than later.

If you have any further questions about your move, don't hesitate to contact us.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Last contact', 'quote_followup', $t$Last chance to make your removal Painless$t$, $t$Hi {{first_name}},

I just wanted to check in and see how things are going with your move.

We sent over your estimate recently, but completely understand you may still be in the early stages or just exploring options.

If you'd like to talk through your quote, ask any questions, or arrange a quick survey, we'd be very happy to help — just reply to this email or give us a call on 0117 2870082.

If now's not the right time, no problem at all — we won't keep chasing, but we're here whenever you need us.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Goodbye', 'lost', $t$Still Here If You Need Us$t$, $t$Dear {{first_name}},

We hope you're doing well. We sent over a quote for your move a little while ago and haven't heard back. Just wanted to let you know we're still here if you need us.

If you've already made other arrangements, no problem at all—but if you have a moment, we'd really appreciate any feedback on why you decided not to go ahead with us. It helps us improve and provide a better service for future customers.

If you do still need help with your move or have any questions, feel free to reach out—we're happy to assist.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Thank You for Accepting', 'accepted', $t$Thank You for Accepting {{job_number}}$t$, $t$Hi {{first_name}},

I hope you're well, and thank you for accepting the quote! Have you confirmed your move date yet? If not, would you like us to hold a date provisionally for you?

We're happy to reserve a slot to give you some peace of mind while final plans are being made.

Just let us know what works best for you.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Moving Date', 'accepted', $t$Moving Date {{job_number}}$t$, $t$Dear {{first_name}},

Thanks for accepting our quote. Do you have a confirmed date for your move? Or is there a date you would like us to hold provisionally?

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Invoice for deposit', 'invoice', $t$Invoice for deposit {{job_number}}$t$, $t$Hi {{first_name}},

Thank you for choosing {{company_name}} to conduct your move. I have attached the invoice for your deposit.
If you have any questions, please don't hesitate to get in touch.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Deposit Receipt', 'receipt', $t$Deposit Receipt {{job_number}}$t$, $t$Dear {{first_name}},

We have received the deposit for your removal. Thank you for making the payment. Please find the receipt attached.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Removal confirmation', 'confirmed', $t$Removal confirmation {{job_number}}$t$, $t$Hi {{first_name}} {{last_name}}

Thank you for confirming your move with {{company_name}}. Your move is booked for {{move_date}}, our team will aim to be with you for {{move_time}}.

Moving from..
{{current_address}}

Moving to…
{{new_address}}

Please feel free to contact us to discuss anything further. If we do not hear from you, we look forward to seeing you on move day.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'Move Invoice', 'invoice', $t$Move Invoice {{job_number}}$t$, $t$Hi {{first_name}},

Your removal invoice is attached. Our bank details are on the invoice. Please feel free to contact the office if you wish to discuss this further.

All the best,
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'Move Receipt', 'receipt', $t$Move Receipt {{job_number}}$t$, $t$Hi {{first_name}},

Thank you, we have received payment for your removal. Please find the receipt attached.

Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
hello@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'Storage', 'storage', $t$Storage Invoice$t$, $t$Dear {{first_name}},

Thank you for storing your belongings with Painless Removals LTD.

Please find attached the invoice for storage fee for the period of (start date) to (end date).

If you have any questions about your storage or wish to make changes, please don't hesitate to get in touch.

Kind Regards
Jay Newton
PAINLESS REMOVALS LTD
0117 2870082
painlessremovals.com
jay@painlessremovals.com$t$, true),

('0e3b13b0-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Please can we get a review?', 'review', $t$Please can we get a review? {{job_number}}$t$, $t$Dear {{first_name}},

We hope you're settling in well to your new home, and thanks again for choosing Painless Removals!

As a small, independent business, we rely heavily on word of mouth and positive reviews. If you were happy with our service, we'd be incredibly grateful if you could take a moment to leave us a review:
Google: Leave a review
Trustpilot: Leave a review

Your feedback means a lot and helps others find a moving company they can trust.

Thanks again, and all the best in your new place!

Kind Regards
Jay Newton
{{company_name}}
jay@painlessremovals.com$t$, false),

('0e3b13b0-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Bank email template', 'manual', $t$Edit subject to suit {{job_number}}$t$, $t$Dear {{first_name}},



Kind Regards
Jay Newton
{{company_name}}
0117 2870082
painlessremovals.com
jay@painlessremovals.com$t$, true)
on conflict (id) do nothing;

-- Automation rules — only the auto-send templates are wired. Manual templates
-- (Photos & List, Moving Date, Storage, Bank scaffold), the alternate survey
-- variant, and the review template (Phase 11 owns review sends — ADR-010) have
-- no rule. Follow-ups use requires_stage so they self-cancel once the customer
-- moves past `quoted` (ADR-024). Delays: 2d=172800, 5d=432000, 10d=864000.
insert into automation_rules (id, company_id, name, trigger_event, trigger_filters, delay_seconds, action_type, action_config, active) values
('0e3b13b1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome email on enquiry', 'job.created', null, 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000001"}', true),
('0e3b13b1-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Survey request on contact', 'job.stage_changed', '{"to":"contacted"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000002"}', true),
('0e3b13b1-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Survey confirmation', 'job.stage_changed', '{"to":"survey_scheduled"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000005"}', true),
('0e3b13b1-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Quotation (removals)', 'job.stage_changed', '{"to":"quoted","service_type":"removal"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000006"}', true),
('0e3b13b1-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Quotation (waste clearance)', 'job.stage_changed', '{"to":"quoted","service_type":"waste_clearance"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000007"}', true),
('0e3b13b1-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Quote follow-up 1 (+2d)', 'job.stage_changed', '{"to":"quoted"}', 172800, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000008","requires_stage":"quoted"}', true),
('0e3b13b1-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Quote follow-up 2 (+5d)', 'job.stage_changed', '{"to":"quoted"}', 432000, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000009","requires_stage":"quoted"}', true),
('0e3b13b1-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Quote last contact (+10d)', 'job.stage_changed', '{"to":"quoted"}', 864000, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000010","requires_stage":"quoted"}', true),
('0e3b13b1-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Thank you for accepting', 'job.stage_changed', '{"to":"accepted"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000012"}', true),
('0e3b13b1-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Removal confirmation', 'job.stage_changed', '{"to":"confirmed"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000016"}', true),
('0e3b13b1-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Move invoice', 'job.stage_changed', '{"to":"invoiced"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000017"}', true),
('0e3b13b1-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Goodbye (lost)', 'job.stage_changed', '{"to":"dead"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000011"}', true),
('0e3b13b1-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Deposit invoice email', 'invoice.created', '{"kind":"deposit"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000014"}', true),
('0e3b13b1-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Deposit receipt email', 'payment.recorded', '{"kind":"deposit"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000015"}', true),
('0e3b13b1-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Move receipt email', 'payment.recorded', '{"kind":"final"}', 0, 'send_email', '{"template_id":"0e3b13b0-0000-0000-0000-000000000018"}', true)
on conflict (id) do nothing;
