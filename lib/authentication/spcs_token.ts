import fs from 'fs';
import Logger from '../logger';

export function getSpcsToken(): string | null {
  try {
    const tokenPath = process.env.SF_SPCS_TOKEN_PATH || '/snowflake/session/spcs_token';
    return fs.readFileSync(tokenPath, 'utf-8').trim();
  } catch (err) {
    Logger().debug(`Failed to read SPCS token: ${err}`);
    return null;
  }
}
