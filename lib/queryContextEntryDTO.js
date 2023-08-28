
/**
 * An entry in the set of query context exchanged with Cloud Services. This includes a domain
 * identifier(id), a timestamp that is monodically increasing, a priority for eviction and the
 * opaque information sent from the Cloud service.
 */

function QueryContextEntryDTO(id, timestamp, priority, context) {
    this.id = id;
    this.timestamp = timestamp;
    this.priority = priority;
    this.context = context;


  this.getId = function() {
    return id;
  }

  this.setId = function(id) {
    this.id = id;
  }

   this.getTimestamp = function() {
    return timestamp;
  }

  this.setTimestamp = function(timestamp) {
    this.timestamp = timestamp;
  }

  this.getPriority = function() {
    return priority;
  }

  this.setPriority = function(priority) {
    this.priority = priority;
  }

   this.getContext = function() {
    return context;
  }

  this.setContext = function(context) {
    this.context = context;
  }
}

module.exports = QueryContextEntryDTO