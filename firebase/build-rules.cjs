const fs = require("node:fs");
const path = require("node:path");

const ids = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"];
const tokenPattern = "/^[0-9a-f]{32}$/";
const cancelPattern = "/^CANCEL:[0-9a-f]{32}$/";

function taken(snapshot, id) {
  return `${snapshot}.child('taken').child('${id}')`;
}

function key(snapshot, id) {
  return `${snapshot}.child('keys').child('${id}')`;
}

function validTransition(id) {
  const oldTaken = taken("data", id);
  const oldKey = key("data", id);
  const nextTaken = taken("newData", id);
  const nextKey = key("newData", id);

  const absentToAbsentOrBooked =
    `(!${oldTaken}.exists() && !${oldKey}.exists() && (` +
      `(!${nextTaken}.exists() && !${nextKey}.exists()) || ` +
      `(${nextTaken}.val() === true && ${nextKey}.val().matches(${tokenPattern}))` +
    `))`;

  const bookedToSameOrCancel =
    `(${oldTaken}.val() === true && ${oldKey}.val().matches(${tokenPattern}) && ` +
      `${nextTaken}.val() === true && (` +
        `${nextKey}.val() === ${oldKey}.val() || ` +
        `${nextKey}.val() === 'CANCEL:' + ${oldKey}.val()` +
      `)` +
    `)`;

  const cancelToSameOrAbsent =
    `(${oldTaken}.val() === true && ${oldKey}.val().matches(${cancelPattern}) && (` +
      `(${nextTaken}.val() === true && ${nextKey}.val() === ${oldKey}.val()) || ` +
      `(!${nextTaken}.exists() && !${nextKey}.exists())` +
    `))`;

  return `(${absentToAbsentOrBooked} || ${bookedToSameOrCancel} || ${cancelToSameOrAbsent})`;
}

const rules = {
  rules: {
    ".read": false,
    ".write": ids.map(validTransition).join(" && "),
    taken: {
      ".read": true,
      "$id": {
        ".validate": `$id.matches(/^g[1-8]$/) && newData.val() === true`,
      },
    },
    keys: {
      "$id": {
        ".read": false,
        ".validate": `$id.matches(/^g[1-8]$/) && newData.val().matches(/^(CANCEL:)?[0-9a-f]{32}$/)`,
      },
    },
    "$other": {
      ".validate": false,
    },
  },
};

fs.writeFileSync(
  path.join(__dirname, "database.rules.json"),
  JSON.stringify(rules, null, 2) + "\n",
  "utf8",
);
