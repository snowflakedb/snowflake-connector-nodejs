const connParameters = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass');

describe('MFA authentication', function () {
    let authTest;

    async function getTotp(authTest, seed = '') {
        const totpGeneratorPath = '/externalbrowser/totpGenerator.js';
        
        if (!authTest.runAuthTestsManually) {
            try {
                const result = await authTest.execWithTimeout(
                    'node',
                    [totpGeneratorPath, seed],
                    40000
                );
                return result.stdout.trim().split();
            } catch (error) {
                throw new Error(`TOTP generation failed: ${error}`);
            }
        } else {
            return '';
        }
    }
    
    async function connectAndExecuteSimpleQueryWithMfaToken(authTest, totpCodes) {
        const baseConnectionOption = connParameters.mfa;
        
        for (let i = 0; i < totpCodes.length; i++) {
            const totpCode = totpCodes[i];
            
            const connectionOption = {
                ...baseConnectionOption,
                passcode: totpCode,
            };
            
            authTest.error = null;
            authTest.callbackCompleted = false;
            
            try {
                authTest.createConnection(connectionOption);
                await authTest.connectAsync();
                
                if (!authTest.error) {
                    await authTest.verifyConnectionIsUp();
                    authTest.error = null;
                    return true;
                }
            } catch (error) {
                authTest.error = error;
            }
            
            if (authTest.error) {
                const lastError = authTest.error.toString();
                
                if (!lastError.includes('TOTP Invalid') && !lastError.includes('Invalid passcode')) {
                    break;
                }
            }
        }
        
        return false;
    }

    beforeEach(async () => {
        authTest = new AuthTest();
    });

    afterEach(async () => {
        await authTest.destroyConnection();
    });

    it('MFA successful authentication with TOTP codes', async function () {
        const connectionParameters = {
            ...connParameters.mfa,
            clientRequestMFAToken: true,
        };
        
        const totpCodes = await getTotp(authTest);
        
        const connectionSuccess = await connectAndExecuteSimpleQueryWithMfaToken(authTest, totpCodes);
        
        if (!connectionSuccess) {
            const errorMessage = authTest.error ? authTest.error.toString() : 'Unknown error';
            throw new Error(`Failed to connect with any of the ${totpCodes.length} TOTP codes. Last error: ${errorMessage}`);
        }
        
        const cacheConnectionOption = {
            ...connectionParameters,
            passcode: null,
        };
        
        authTest.error = null;
        authTest.callbackCompleted = false;
        
        authTest.createConnection(cacheConnectionOption);
        await authTest.connectAsync();
        
        if (authTest.error) {
            throw new Error(`Failed to connect with cached MFA token. Error: ${authTest.error.toString()}`);
        }
        
        await authTest.verifyConnectionIsUp();
    });
});