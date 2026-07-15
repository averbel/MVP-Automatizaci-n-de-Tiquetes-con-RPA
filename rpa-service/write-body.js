const fs = require('fs');
const body = `
5:00 PM
 – 
6:06 PM
JetSMARTOperated by Jetsmart Airlines S.a.s.
1 hr 6 min
BOG–MDE
Nonstop
47 kg CO2e
Avg emissions
$82
round trip
8:50 PM
 – 
9:51 PM
Wingo
1 hr 1 min
BOG–MDE
Nonstop
43 kg CO2e
Avg emissions
$84
round trip
12:25 PM
 – 
1:25 PM
LATAMOperated by Latam Airlines Colombia
1 hr
BOG–MDE
Nonstop
43 kg CO2e
Avg emissions
$108
round trip`;

fs.writeFileSync('body.txt', body, 'utf8');
