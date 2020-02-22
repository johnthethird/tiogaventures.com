/*
  A simple ISO timestamp for Nunjucks
*/
module.exports = function(date) {
  let timestamp = new Date(date)
  return timestamp.toISOString().slice(0, 10)
  //return timestamp.getFullYear() + "-" + (timestamp.getMonth() + 1) + "-" + timestamp.getDate()
}
