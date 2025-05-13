---
name: Bug Report 🐞
about: Something isn't working as expected? Here is the right place to report.
labels: bug
---

If you need **urgent assistance** then [file a case with Snowflake Support](https://community.snowflake.com/s/article/How-To-Submit-a-Support-Case-in-Snowflake-Lodge).
Otherwise continue here.

Please answer these questions before submitting your issue.
In order to accurately debug the issue this information is required. Thanks!

1. What version of NodeJS driver are you using?
2. What operating system and processor architecture are you using?
3. What version of NodeJS are you using?
   (`node --version` and `npm --version`)

4. What are the component versions in the environment (`npm list`)?

5. What did you do?

   If possible, provide a recipe for reproducing the error.
   A complete runnable program would be the most helpful.

6. What did you expect to see?

   What should have happened and what happened instead?

7. Can you collect debug logs?

   https://community.snowflake.com/s/article/How-to-generate-log-file-on-Snowflake-connectors

e.g
Add this to get TRACE logs sent to standard output.

```
var snowflake = require('snowflake-sdk');
snowflake.configure(
{
  logLevel: 'trace'
});
```

:warning: Before sharing any data, please be sure to review the log and remove any sensitive
information.
