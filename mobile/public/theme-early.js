// The Co-op look (dark) unless Light mode was chosen on this phone: paint the page dark before the app
// loads, so it never flashes white
try {
  if (localStorage.getItem('optimas.theme') !== 'light') {
    document.documentElement.classList.add('dark');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#0D1310');
  }
} catch (e) {
  document.documentElement.classList.add('dark');
}
