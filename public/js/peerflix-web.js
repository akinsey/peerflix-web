var isPaused = true;

function showPauseIcon(paused) {
  var pauseButton = document.getElementById('pause-button');
  if (paused) {
    pauseButton.className = 'btn btn-custom full-width control-btn glyphicon glyphicon-pause';
    isPaused = true;
  }
  else {
    pauseButton.className = 'btn btn-custom full-width control-btn glyphicon glyphicon-play';
    isPaused = false;
  }
}

function start() {
  document.getElementById('start-wrapper').style.display = 'none';
  document.getElementById('stop-wrapper').style.display = 'block';
  document.getElementById('loader').style.display = 'inline-block';
  showPauseIcon(true);
  var torrentUrlInput = document.getElementById('torrent-url');
  var url = torrentUrlInput.value;

  var req = new XMLHttpRequest();

  req.onreadystatechange = function() {
    var loader = document.getElementById('loader');
    loader.style.display = 'none';
    torrentUrlInput.value = '';
  };

  req.open('POST', 'play', true);
  req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  req.send('url=' + url);
}

function stop() {
  document.getElementById('stop-wrapper').style.display = 'none';
  document.getElementById('start-wrapper').style.display = 'block';
  document.getElementById('loader').style.display = 'none';
  showPauseIcon(true);
  var req = new XMLHttpRequest();
  req.open('POST', 'stop', true);
  req.send();
}

function pause() {
  showPauseIcon(!isPaused);
  var req = new XMLHttpRequest();
  req.open('POST', 'pause', true);
  req.send();
}

function forward() {
  var req = new XMLHttpRequest();
  req.open('POST', 'forward', true);
  req.send();
}

function backward() {
  var req = new XMLHttpRequest();
  req.open('POST', 'backward', true);
  req.send();
}

function search() {
  var torrentQueryInput = document.getElementById('torrent-query');
  var searchStr = torrentQueryInput.value;

  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    var torrentTable = document.getElementById('torrent-table');
    if (req.readyState === 4) {
      var searchResults = JSON.parse(req.responseText);
      torrentTable.innerHTML = searchResults.length ? '<thead><tr><th width="50%">Title</th><th width="25%">Seed</th><th width="25%">Leech</th></tr></thead>' : '';
      searchResults.forEach(function(result) {
        var title = result.title;
        var torrentLink = result.torrentLink;
        var seeds = result.seeds;
        var leechs = result.leechs;
        torrentTable.innerHTML += '<tr><td width="50%"><a href="' + torrentLink + '">' + title + '</a></td><td width="25%">' + seeds + '</td><td width="25%">' + leechs + '</td></tr>';
      });
    }
    else { torrentTable.innerHTML = ''; }
  };
  req.open('GET', 'query?q=' + searchStr, true);
  req.send();
}
