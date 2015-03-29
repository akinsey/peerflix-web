# Peerflix Web
Easily stream torrents to a Raspberry Pi via your smart phone, tablet or pc. Peerflix web provides an interface to stream torrents using peerflix and control playback via omxplayer. For convenience, you can also search torrents directly using peerflix web.


**NOTE**: This has only been tested on Raspbian running on a Raspberry Pi 2.

![Peerflix web](http://i.imgur.com/U1pEcOE.png)

![Peerflix web](http://i.imgur.com/OWom6Mi.png)

##Setup

**NPM Installation**
```sh
$ npm install -g peerflix-web
$ peerflix-web
```

**Manual Installation**
```sh
$ git clone git@github.com:akinsey/peerflix-web.git
$ cd peerflix-web
$ npm install
$ node server
```

**Running on startup**

This project can be setup to run from /etc/init.d so it will automatically start up with your Raspberry Pi. Edit the custom configs at the top of the `example.peerflix-web` file and move
the script to `/etc/init.d/peerflix-web`. Once in the init.d directory, you can control the server using the following commands:

```sh
$ /etc/init.d/peerflix-web start # add --force to force start
$ /etc/init.d/peerflix-web stop  # add --force to force stop
$ /etc/init.d/peerflix-web status # view current status of running app
```

##Contributions
Currently this project is designed specifically to work with omxplayer running raspbian, but it can easily be adapted to work with vlc player as well. I may add support for this in the future, in the meantime I am open to pull requests for missing features that others think might be useful.

##Requirements
* `omxplayer` - default media player for raspbian

##License
MIT
