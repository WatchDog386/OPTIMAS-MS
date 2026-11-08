// Dark unless Light mode was chosen on this phone: paint the page dark before the app loads, so it never
// flashes white. (The status bar stays the splash's blue until the app has opened.)
try {
  if (localStorage.getItem('optimas.theme') !== 'light') {
    document.documentElement.classList.add('dark');
  }
} catch (e) {
  document.documentElement.classList.add('dark');
}

// The page itself never scrolls (the app scrolls inside its own lists): put it back if anything moves it
window.addEventListener('scroll', function () {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  var r = document.documentElement;
  if (r.scrollTop || r.scrollLeft) { r.scrollTop = 0; r.scrollLeft = 0; }
});
