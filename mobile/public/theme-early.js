// Dark mode chosen on this phone: paint the page dark before the app loads, so it never flashes white
try {
  if (localStorage.getItem('optimas.theme') === 'dark') {
    document.documentElement.classList.add('dark');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#17181B');
  }
} catch (e) {}
