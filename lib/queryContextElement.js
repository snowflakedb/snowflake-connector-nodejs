  
  /**
     * Constructor.
     *
     * @param id database id
     * @param readTimestamp Server time when this entry read
     * @param priority Priority of this entry w.r.t other ids
     * @param context Opaque query context, used by query processor in the server.
     */

  /** Query context information. */
  function QueryContextElement(id,readTimestamp,priority,context) {
    this.id = id;
    this.readTimestamp = readTimestamp;
    this.priority = priority;
    this.context = context;

    

    

    /**
     * Keep elements in ascending order of the priority. This method called by TreeSet.
     *
     * @param obj the object to be compared.
     * @return 0 if equals, -1 if this element is less than new element, otherwise 1.
     */
    // public int compareTo(QueryContextElement obj) {
    //   return (priority == obj.priority) ? 0 : (((priority - obj.priority) < 0) ? -1 : 1);
    // }

    this.setId = function(id) {
      this.id = id;
    }

    this.setPriority = function(priority) {
       this.priority = priority;
    }

    this.setContext = function(context) {
       this.context = context;
    }

    this.setReadTimestamp = function(readTimestamp) {
      this.readTimestamp = readTimestamp;
    }

    this.getId = function() {
      return id;
    }

   this.getReadTimestamp = function() {
      return readTimestamp;
    }

    this.getPriority = function() {
      return priority;
    }

    this.getContext = function() {
      return context;
    }
   
  }

  QueryContextElement.prototype.equals = function(obj) {
    if (obj == this) {
      return true;
    }

    if (!(obj instanceof QueryContextElement)) {
      return super.equals(obj);
    }

    
    return (id == obj.id
        && readTimestamp == obj.readTimestamp
        && priority == obj.priority
        && context.equals(obj.context));
  }

  QueryContextElement.prototype.hashCode=function() {
    let hash = 31;

    hash = hash * 31 + parseInt(this.id);
    hash += (hash * 31) + parseInt(this.readTimestamp);
    hash += (hash * 31) + parseInt(this.priority);
    hash += (hash * 31) + this.context.hashCode();

    return hash;
  }

   /**
   * @param id the id of the element
   * @param timestamp the last update timestamp
   * @param priority the priority of the element
   * @param opaqueContext the binary data of the opaque context
   * @return a query context element
   */
    QueryContextElement.prototype.createElement = function(id, timestamp, priority, opaqueContext) {
        return new QueryContextElement(id, timestamp, priority, opaqueContext);
    }





  module.exports = QueryContextElement;