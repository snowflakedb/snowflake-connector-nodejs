const QueryContextCache = require("./lib/queryContextCache");

const qcc = new QueryContextCache(5);

function QueryContextElement (id,timestamp,priority,context) {
    this.id = id;
    this.timestamp = timestamp;
    this.priority = priority;
    this.context = context;
  }

 qcc.merge(new QueryContextElement(0,262026291380200,0,null));
 qcc.merge(new QueryContextElement(1404143425,50181150913550,1,null));
 qcc.merge(new QueryContextElement(1404143429,50181150913550,2,null));

 qcc.merge(new QueryContextElement(1404143433,50181150913550,3,null));


 console.log(qcc);

 qcc.merge(new QueryContextElement(1404143433,50181151673926,2,null))

 console.log(qcc);