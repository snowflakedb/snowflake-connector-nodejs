import fs from 'fs';
import Logger from '../logger';

export function getSpcsToken(): string | null {
  if (!process.env['SNOWFLAKE_RUNNING_INSIDE_SPCS']) {
    return null;
  }
  try {
    return fs.readFileSync('/snowflake/session/spcs_token', 'utf-8').trim();
  } catch (err) {
    Logger().warn(`Failed to read SPCS token: ${err}`);
    return null;
  }
}
