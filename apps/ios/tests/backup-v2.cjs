const {run}=require('../../../packages/backup-core/test.cjs');
run(require('./load-ts.cjs')).catch(e=>{console.error(e);process.exitCode=1;});
