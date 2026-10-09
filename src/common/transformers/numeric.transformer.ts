import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric`/`decimal` columns come back as strings via the pg driver.
 * This transformer keeps the JS/TS side as `number` while storing exact decimals.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null =>
    value == null ? null : parseFloat(value),
};
