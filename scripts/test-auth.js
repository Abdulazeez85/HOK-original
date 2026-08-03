(async () => {
  try {
    const base = 'http://localhost:3000';
    const body = JSON.stringify({ username: 'hokadmin', password: 'hokcomputers2025' });

    const res1 = await fetch(base + '/api/adminlogin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    console.log('LOGIN status', res1.status);
    const text1 = await res1.text(); console.log('LOGIN body', text1);
    const setcookie = res1.headers.get('set-cookie');
    console.log('SET-COOKIE', setcookie);
    const cookieHeader = setcookie ? setcookie.split(';')[0] : '';

    const res2 = await fetch(base + '/api/admincheck', { headers: { Cookie: cookieHeader } });
    console.log('CHECK1 status', res2.status); console.log(await res2.text());

    const resLogout = await fetch(base + '/api/adminlogout', { method: 'POST', headers: { Cookie: cookieHeader } });
    console.log('LOGOUT status', resLogout.status); console.log(await resLogout.text());

    const res3 = await fetch(base + '/api/admincheck', { headers: { Cookie: cookieHeader } });
    console.log('CHECK2 status', res3.status); console.log(await res3.text());
  } catch (e) {
    console.error('ERROR', e);
  }
})();
