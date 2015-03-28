# Peerflix Web
Web interface to remotely stream torrents using peerflix to a Raspberry Pi. This has only been tested on Raspbian running on a Raspberry Pi 2.

![Peerflix web](http://i.imgur.com/U1pEcOE.png)

![Peerflix web](http://i.imgur.com/OWom6Mi.png)

###Setup
```sh
$ git clone git@github.com:akinsey/peerflix-web.git
$ cd peerflix-web
$ npm install
$ node server
```
`NOTE:` This project can be setup to run from /etc/init.d so it will automatically start up with your Raspberry Pi

###Requirements
* `omxplayer` - default media player for raspbian


###License
MIT
