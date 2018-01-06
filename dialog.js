// (C) 2017 Alexander Shashkevich
// Minimalistic draggable and collapsable dialog with pure js
// License: GPL-3.0

'use strict';

(function(w, d) {
  w.newDialog = (config) => {
  	// Default dialog context
    let ctx = {
      config: {
        title: 'Title',
        content: '',
        x: null, y: null,
        width: 300, height: 200,
        maximized: true
      },
      dialog: null,
      title: null,
      content: null,
      minmax: null,
      maximized: true,
      drag: {
      	mouseX:0, mouseY:0,
        dialogX:0, dialogY:0
      },
    };

		// Merge config with default
    for (let i in config)
    	ctx.config[i] = (typeof(config[i])) ? config[i] : ctx.config[i];

		ctx.dialog = d.createElement('div');
    ctx.title = d.createElement('div');
    ctx.minmax = d.createElement('span');
    ctx.content = d.createElement('div');

		ctx.dialog.appendChild(ctx.title);
    ctx.dialog.appendChild(ctx.minmax);
    ctx.dialog.appendChild(ctx.content);
    d.body.appendChild(ctx.dialog);

    ctx.dialog.className = 'dlg-box';
    ctx.minmax.className = 'dlg-minmax';
    ctx.minmax.innerHTML = '&ndash;';
    ctx.title.className = 'dlg-title';
    ctx.content.className = 'dlg-content';

    ctx.dialog.style.width = ctx.config.width + 'px';
    ctx.dialog.style.minHeight = ctx.config.maximized ? ctx.config.height + 'px' : '1px';
    ctx.dialog.style.maxHeight = ctx.config.height + 'px';
    ctx.dialog.style.left = ctx.config.x === null ? (w.innerWidth - ctx.config.width) / 2 + 'px': ctx.config.x + 'px';
    ctx.dialog.style.top = ctx.config.y === null ? (w.innerHeight - ctx.config.height) / 2 + 'px': ctx.config.y + 'px';
    ctx.content.style.display = ctx.config.maximized ? 'block' : 'none';
    ctx.maximized = ctx.config.maximized;
      
   	// Content section
    if (typeof ctx.config.title === 'string')
			ctx.title.innerHTML = ctx.config.title;
    else
    	ctx.title.appendChild(ctx.config.title);
    
    if (typeof ctx.config.content === 'string')
			ctx.content.innerHTML = ctx.config.content;
    else
      ctx.content.appendChild(ctx.config.content);

		// Dragging...
		const eventMouseMove = (ev) => {
      const dx = ev.clientX - ctx.drag.mouseX,
            dy = ev.clientY - ctx.drag.mouseY;

      ctx.dialog.style.left = ctx.drag.dialogX + dx + 'px';
      ctx.dialog.style.top = ctx.drag.dialogY + dy + 'px';
    };

		// End drag...
		const eventMouseUp = () => {
    	d.removeEventListener('mousemove', eventMouseMove);
    };

		// Start drag...
    const eventMouseDown = (ev) => {
      ctx.drag.mouseX = ev.clientX;
      ctx.drag.mouseY = ev.clientY;
      ctx.drag.dialogX = ev.target.parentNode.offsetLeft;
      ctx.drag.dialogY = ev.target.parentNode.offsetTop;

      d.addEventListener('mousemove', eventMouseMove);

      if(ev.preventDefault) ev.preventDefault();
      ev.cancelBubble = true;
    	ev.returnValue = false;

			return false;
    };

		ctx.title.addEventListener('mousedown', eventMouseDown);
    ctx.title.addEventListener('mouseup', eventMouseUp);

		ctx.minmax.onclick = () => {
      ctx.content.style.display = ctx.maximized ? 'none' : 'block';
      ctx.dialog.style.minHeight = ctx.maximized ? '1px' : ctx.config.height + 'px';
      ctx.maximized = !ctx.maximized;
    };

    ctx.close = () => {
    	d.removeEventListener('mousemove', eventMouseMove);
      d.body.removeChild(ctx.dialog);
      ctx.dialog = null;
      ctx.minmax = null;
      ctx.title = null;
      ctx.content = null;
    };

		return ctx;
  };
})(window, document);
