$(document).ready(function() {

  var isPaused = false;

  (function poll(){
    var firstRun = true;
    var updateStatus = function() {
      $.ajax({ url: 'status', success: function(status) {
        if (status === 'PAUSED') {
          $('#stop-wrapper').show();
          $('#start-wrapper').hide();
          $('#omx-controls').show();
          $('#loader').hide();
        }
        else if (status === 'IDLE') {
          isPaused = true;
          $('#omx-controls').hide();
        }
        else {
          $('#stop-wrapper').show();
          $('#start-wrapper').hide();
          $('#omx-controls').show();
          $('#loader').hide();
          if (firstRun) { // Show play button if already playing
            showPauseIcon(true);
            firstRun = false;
          }
        }
      }, dataType: 'text' });
    };

    updateStatus();
    setInterval(function() {
      updateStatus();
    }, 5000);
  })();

  var showPauseIcon = function(paused) {
    if (paused) {
      $('#pause').removeClass('glyphicon-play');
      $('#pause').addClass('glyphicon-pause');
      isPaused = true;
    }
    else {
      $('#pause').removeClass('glyphicon-pause');
      $('#pause').addClass('glyphicon-play');
      isPaused = false;
    }
  };

  $('#start').click(function() {
    $('#start-wrapper').hide();
    $('#stop-wrapper').show();
    $('#loader').show();
    showPauseIcon(true);
    var url = $('#torrent-url').val();
    $('#torrent-url').val('');
    $.post('play', { 'url': url })
    .fail(function() {
      $('#loader').hide();
      $('#stop-wrapper').hide();
      $('#start-wrapper').show();
    });
  });

  $('#torrent-url').keydown(function(e) {
    if (e.which === 13) { $('#start').click(); }
  });

  $('#stop').click(function() {
    $('#stop-wrapper').hide();
    $('#start-wrapper').show();
    $('#loader').hide();
    showPauseIcon(true);
    $.post('stop');
  });

  $('#backward').click(function() {
    $.post('backward');
  });

  $('#pause').click(function() {
    showPauseIcon(!isPaused);
    $.post('pause');
  });

  $('#forward').click(function() {
    $.post('forward');
  });

  $('#search-torrents').click(function() {
    var searchStr = $('#torrent-query').val();
    if (!searchStr.length) { $('#torrent-table').empty(); return; }
    $.get('query', { 'q': searchStr })
    .done(function(searchResults) {
      $('#torrent-table').html(searchResults.length ? '<thead><tr><th width="60%">Title</th><th width="15%"><span class="glyphicon glyphicon-menu-up"></span></th><th width="15%"><span class="glyphicon glyphicon-menu-down"></span></th></tr></thead>' : '');
      searchResults.forEach(function(result) {
        var title = result.title;
        var torrentLink = result.torrentLink;
        var seeds = result.seeds;
        var leechs = result.leechs;
        $('#torrent-table').append('<tr><td style="word-break: break-all;"><a href="' + torrentLink + '">' + title + '</a></td><td><span style="color:green;">' + seeds + '</span></td><td><span style="color:red;">' + leechs + '</span></td></tr>');
      });
      if (!searchResults.length) { $('#torrent-table').empty(); }
    })
    .fail(function() {
      $('#torrent-table').empty();
    });
  });

  $('#torrent-query').keydown(function(e) {
    if (e.which === 13) { $('#search-torrents').click(); }
  });
});
