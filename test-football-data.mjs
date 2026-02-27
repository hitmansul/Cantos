const url = "https://api.football-data.org/v4/competitions/PL/standings";

const res = await fetch(url, {
  headers: {
    "X-Auth-Token": "ace81330856c4a53b63a8005928c9a42",
  },
});

console.log("Status:", res.status);
console.log(await res.text());