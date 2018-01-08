// (C) 2017 Alexander Shashkevich
// Minimalistic draggable and collapsable dialog with pure js
// License: GPL-3.0

'use strict';

(function(w, d) {
  w.newDialog = (c) => {

    // Context
    let ctx = {};

    // Default config
    let cfg = {
      title: 'Title',
      content: '',
      x: null, y: null,
      width: 300, height: 200,
      close: true, // Show close button
      minmax: true, // Show min/max button
      minimized: false // Create minimized dialog
    };
    
    // UI elements
    let ui = {
      dialog: null,
      title: null,
      content: null,
      minmax: null,
      close: null,
    };

    // Dialog movemet
    let mv = {
      mouseX:0, mouseY:0,
      dialogX:0, dialogY:0
    };

    // Merge config with default
    for (let i in c)
        cfg[i] = (typeof(c[i])) ? c[i] : cfg[i];

    ui.dialog = d.createElement('div');
    ui.title = d.createElement('div');
    ui.minmax = d.createElement('span');
    ui.close = d.createElement('span');
    ui.content = d.createElement('div');

    ui.dialog.appendChild(ui.close);
    ui.dialog.appendChild(ui.minmax);
    ui.dialog.appendChild(ui.title);
    ui.dialog.appendChild(ui.content);
    d.body.appendChild(ui.dialog);

    ui.dialog.className = 'dlg-box';
    ui.minmax.className = 'dlg-minmax';
    ui.minmax.innerHTML = '&ndash;';
    ui.close.innerHTML = '&times;';
    ui.close.className = 'dlg-close';
    ui.title.className = 'dlg-title';
    ui.content.className = 'dlg-content';

    ui.dialog.style.width = cfg.width + 'px';
    ui.dialog.style.minHeight = cfg.minimized ? '1px' : cfg.height + 'px';
    ui.dialog.style.maxHeight = cfg.height + 'px';
    ui.dialog.style.left = cfg.x === null ? (w.innerWidth - cfg.width) / 2 + 'px': cfg.x + 'px';
    ui.dialog.style.top = cfg.y === null ? (w.innerHeight - cfg.height) / 2 + 'px': cfg.y + 'px';
    ui.content.style.display = cfg.minimized ? 'none' : 'block';

    if (cfg.close === false)
        ui.close.style.display = 'none';

    if (cfg.minmax === false)
        ui.minmax.style.display = 'none';

   	// Content section
    if (typeof cfg.title === 'string')
        ui.title.innerHTML = cfg.title;
    else
        ui.title.appendChild(cfg.title);
    
    if (typeof cfg.content === 'string')
        ui.content.innerHTML = cfg.content;
    else
        ui.content.appendChild(cfg.content);

    // Dragging...
    const eventMouseMove = (ev) => {
        const dx = ev.clientX - mv.mouseX,
            dy = ev.clientY - mv.mouseY;

        ui.dialog.style.left = mv.dialogX + dx + 'px';
        ui.dialog.style.top = mv.dialogY + dy + 'px';
    };

    // End drag...
    const eventMouseUp = () => {
    	d.removeEventListener('mousemove', eventMouseMove);
    };

    // Start drag...
    const eventMouseDown = (ev) => {
        mv.mouseX = ev.clientX;
        mv.mouseY = ev.clientY;
        mv.dialogX = ev.target.parentNode.offsetLeft;
        mv.dialogY = ev.target.parentNode.offsetTop;

        d.addEventListener('mousemove', eventMouseMove);

        if(ev.preventDefault) ev.preventDefault();
        
        ev.cancelBubble = true;
    	ev.returnValue = false;

        return false;
    };

    ctx.close = () => {
        d.removeEventListener('mousemove', eventMouseMove);
        d.body.removeChild(ui.dialog);
        ui.dialog = null;
        ui.minmax = null;
        ui.title = null;
        ui.content = null;
        ui.close = null;
    };

    ui.title.addEventListener('mousedown', eventMouseDown);
    ui.title.addEventListener('mouseup', eventMouseUp);

    ui.minmax.onclick = () => {
        ui.content.style.display = cfg.minimized ? 'block' : 'none';
        ui.dialog.style.minHeight = cfg.minimized ? cfg.height + 'px' : '1px' ;
        cfg.minimized = !cfg.minimized;
    };

    ui.close.onclick = ctx.close;

    return ctx;
};
})(window, document);
