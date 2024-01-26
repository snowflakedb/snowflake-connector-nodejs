const snowflake = require('./../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('./connectionOptions');

if (process.env.RUN_MANUAL_TESTS_ONLY === 'true') {
    describe.only('Retry Strategy',function() {
    process.env.RETRY_STRATEGY_TEST = "true"  
    this.timeout(3000000);
    after(()=>{
        delete process.env.RETRY_STRATEGY_TEST
    });
        it('test - AuthOkta retry strategy', async function () {
            
            const connection = snowflake.createConnection({
              ...connOption.okta, 
              retryTimeout: 0,
              
            });
            try{
                await connection.connectAsync();
            } catch (err){
                assert.strictEqual(err.numoRetries, 7);
                assert.ok(err.totalElaspedTime > 300);
                assert.strictEqual(err.message, 'Failed to all retries to SF');
            }
    });

    it('test - retry strategy', async function () {
     
        const connection = snowflake.createConnection(connOption.valid);
        try{
            await connection.connectAsync();
        } catch (err){
            assert.strictEqual(err.numoRetries, 7);
            assert.ok(err.totalElaspedTime > 300);
            assert.strictEqual(err.message, 'Failed to all retries to SF');
        }
});
});
}