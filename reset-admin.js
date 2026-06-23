const bcrypt = require('bcryptjs');
const fs = require('fs');

bcrypt.hash('hokcomputers2025', 10).then(hash => {
  fs.writeFileSync('./data/admin.json', JSON.stringify({
    username: 'hokadmin',
    password: hash
  }, null, 2));
  console.log('✅ Done — admin.json reset successfully');
});