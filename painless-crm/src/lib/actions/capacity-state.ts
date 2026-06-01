// Action state for the capacity override forms. Kept out of the 'use server'
// module because a 'use server' file may only export async functions — a
// non-function export (the INITIAL constant) makes the module fail to load.

export type CapacityOverrideState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_CAPACITY_OVERRIDE_STATE: CapacityOverrideState = { status: 'idle' };
