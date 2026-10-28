// Play counts for the GoatCounter dashboard (https://mochi-roguelike.goatcounter.com).
// The script tag in index.html counts page visits; track() adds game events, which show up
// in the dashboard like pages (e.g. "run/start/lilo"). GoatCounter skips localhost, and if the
// script is blocked or still loading the event is simply not counted.
export function track(path) {
  try {
    window.goatcounter?.count?.({ path, title: path, event: true });
  } catch {
    // Counting must never break the game.
  }
}
