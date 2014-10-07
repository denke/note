var dn = require('./index.js');

dn.start({
	content: '../denke-note/src/', // content folder
	stealth: false, // (example: '/hidden/path/')
	baseUrl: '', // to use when stealth changes routes (example: '../../')
	salt: 'uita+kap.pa8hae7*' // usado nos hashes
});