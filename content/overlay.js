xtk.load('chrome://sass/content/sass/sass.js');

/**
 * Namespaces
 */
if (typeof(extensions) === 'undefined') extensions = {};
if (typeof(extensions.sass) === 'undefined') extensions.sass = {
	version: '2.0'
};
(function() {
	var notify = require("notify/notify"),
		$ = require("ko/dom"),
		self = this,
		search = false,
		editor = require("ko/editor"),
		prefs = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService).getBranch("extensions.sass.");


	if (!('sass' in ko)) ko.extensions = {};
	var myExt = "SassCompiler@komodoeditide.com";
	if (!(myExt in ko.extensions)) ko.extensions[myExt] = {};
	if (!('myapp' in ko.extensions[myExt])) ko.extensions[myExt].myapp = {};
	var sassData = ko.extensions[myExt].myapp;
	
	if (extensions.sass && extensions.sass.onKeyPress)
	{
		ko.views.manager.topView.removeEventListener(
			'keypress',
			extensions.sass._onKeyPress, true
		);

		window.removeEventListener("komodo-post-startup", self._StartUpAction, false);
		window.removeEventListener("view_opened", self.getVars, false);
		window.removeEventListener("focus", self._focusAction, false);
		window.removeEventListener("file_saved", self._AfterSafeAction, false);
		window.removeEventListener("current_view_changed", self._updateView, false);
	}



	this.compileFile = function(showWarning, compress, getVars) {
		showWarning = showWarning || false;
		compress = compress || false;
		getVars = getVars || false;

		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			fileContent = self._getContent(d),
			file = fileContent.file,
			buffer = fileContent.buffer,
			base = fileContent.base,
			path = fileContent.path,
			compilerEnabled = prefs.getBoolPref('compilerEnabled');

		if (!compilerEnabled && !getVars) {
			return;
		}

		if (!file || !path) {
			return;
		}

		if (file.ext == '.sass' || file.ext == '.scss') {
			if (getVars) {
				notify.send(
					'SASS: Getting SASS vars',
					'tools'
				);	
			} 
		
			outputSass = self._process_sass(path, base, buffer, file.ext);
			if (getVars) {
				var allVars = self._getVars(outputSass);
				sassData.vars = allVars;
				if (sassData.vars === undefined) {
					sassData.vars = [ "$No_vars_found" ];
					notify.send(
						'SASS: No SASS vars found',
						'tools'
					);	
				}
				
			} else {
				var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
				SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
				treatAsSass = file.ext == '.sass' ? true : false;
				
				sass.compile(outputSass, {  style: SassStyle, indentedSyntax: treatAsSass }, function(result){
					if (result.status == 0) {
						var newFilename = path.replace(file.ext, '.css');
						self._saveFile(newFilename, result.text);
						notify.send(
							'SASS: File saved',
							'tools'
						);
						self._updateStatusBar();
					} else {
						notify.send(
							'SASS ERROR: ' + result.message,
							'tools'
						);
						self._updateStatusBar('SASS ERROR: ' + result.message);
						console.error('SASS ERROR: ' + result.formatted);
					}
				});
			}
		} else {
			return;
		}
	};

	this.compileCompressFile = function(showWarning) {
		this.compileFile(showWarning, true);
	};

	this.compileBuffer = function(compress) {
		compress = compress || false;

		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			buffer = d.buffer,
			base = (file) ? file.baseName : null,
			path = (file) ? file.URI : null;
			
		if (!file || !path) {
			notify.send(
				'SASS: Please save the file first',
				'tools'
			);	
			return;  
		}
		
		outputSass = self._process_sass(path, base, buffer, file.ext);
		
		var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
		SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
		treatAsSass = file.ext == '.sass' ? true : false;
		
		sass.compile(outputSass, {  style: SassStyle, indentedSyntax: treatAsSass }, function(result){
			if (result.status == 0) {
				d.buffer = result.text;
				notify.send(
				'SASS: Compiled SASS selection',
					'tools'
				);
				self._updateStatusBar();
			} else {
				notify.send(
					'SASS ERROR: ' + result.message,
					'tools'
				);
				self._updateStatusBar('SASS ERROR: ' + result.message);
				console.error('SASS ERROR: ' + result.formatted);
			}
		});
	};

	this.compileCompressBuffer = function() {
		this.compileBuffer(true);
	}

	this.compileSelection = function(compress) {
		compress = compress || false;

		var view = ko.views.manager.currentView,
			scimoz = view.scintilla.scimoz;
			text = scimoz.selText,
			d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			fileContent = d.buffer,
			base = (file) ? file.baseName : null,
			path = (file) ? file.URI : null;
			
			if (!file || !path) {
				notify.send(
					'SASS: Please save the file first',
					'tools'
				);	
				return;  
			}
			
	
		outputSass = self._process_sass(path, base, text, file.ext);
		
		var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
		SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
		treatAsSass = file.ext == '.sass' ? true : false;
		
		sass.compile(outputSass, {  style: SassStyle, indentedSyntax: treatAsSass }, function(result){
			if (result.status == 0) {
				var sass = result.text;
				scimoz.replaceSel(sass);
				notify.send(
				'SASS: Compiled SASS selection',
					'tools'
				);
				self._updateStatusBar();
			} else {
				notify.send(
					'SASS ERROR: ' + result.message,
					'tools'
				);
				self._updateStatusBar('SASS ERROR: ' + result.message);
				console.error('SASS ERROR: ' + result.formatted);
			}
		});
	};

	this.compileCompressSelection = function() {
		this.compileSelection(true);
	}

	this.getVars = function(search) {
		search = search || false;
		var useFileWatcher = prefs.getBoolPref('useFilewatcher'),
			fileWatcher = prefs.getCharPref('fileWatcher'),
			d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			path = (file) ? file.URI : null;
	
		if (!file) {
			return false;
		}
	
		if (file.ext === '.sass' || file.ext === '.scss') {
			if (useFileWatcher) {
				var parser = ko.uriparse;
				if (parser.displayPath(path) === parser.displayPath(fileWatcher)) {
					self.compileFile(false, false, true);
				} else if (search) {
					//self._getVarsFromBuffer(); TODO only collect from current buffer
					self.compileFile(false, false, true);
				}
			} else {
				self.compileFile(false, false, true);
			}
		}
		return false;
	}

	this._getContent = function(doc) {
		var file = doc.file,
			buffer = doc.buffer,
			base = (file) ? file.baseName : null,
			filePath = (file) ? file.URI : null,
			path = '';
		output = {};


		if (prefs.getBoolPref('useFileScopes')) {
			var outputfile01 = prefs.getCharPref('outputfile01'),
				outputfile02 = prefs.getCharPref('outputfile02'),
				outputfile03 = prefs.getCharPref('outputfile03'),
				includeSass01Folder01 = prefs.getCharPref('includeSass01Folder01').length > 0 ? prefs.getCharPref('includeSass01Folder01') : null,
				includeSass01Folder02 = prefs.getCharPref('includeSass01Folder02').length > 0 ? prefs.getCharPref('includeSass01Folder02') : null,
				includeSass01Folder03 = prefs.getCharPref('includeSass01Folder03').length > 0 ? prefs.getCharPref('includeSass01Folder03') : null,
				includeSass02Folder01 = prefs.getCharPref('includeSass02Folder01').length > 0 ? prefs.getCharPref('includeSass02Folder01') : null,
				includeSass02Folder02 = prefs.getCharPref('includeSass02Folder02').length > 0 ? prefs.getCharPref('includeSass02Folder02') : null,
				includeSass02Folder03 = prefs.getCharPref('includeSass02Folder03').length > 0 ? prefs.getCharPref('includeSass02Folder03') : null,
				includeSass03Folder01 = prefs.getCharPref('includeSass03Folder01').length > 0 ? prefs.getCharPref('includeSass03Folder01') : null,
				includeSass03Folder02 = prefs.getCharPref('includeSass03Folder02').length > 0 ? prefs.getCharPref('includeSass03Folder02') : null,
				includeSass03Folder03 = prefs.getCharPref('includeSass03Folder03').length > 0 ? prefs.getCharPref('includeSass03Folder03') : null,
				parser = ko.uriparse
			displayPath = parser.displayPath(filePath);

			if (outputfile01.length > 0) {
				if (displayPath.indexOf(parser.displayPath(includeSass01Folder01)) !== -1) {
					path = outputfile01;
				} else if (displayPath.indexOf(parser.displayPath(includeSass01Folder02)) !== -1) {
					path = outputfile01;
				} else if (displayPath.indexOf(parser.displayPath(includeSass01Folder03)) !== -1) {
					path = outputfile01;
				}
			}

			if (outputfile02.length > 0) {
				if (displayPath.indexOf(parser.displayPath(includeSass02Folder01)) !== -1) {
					path = outputfile02;
				} else if (displayPath.indexOf(parser.displayPath(includeSass02Folder02)) !== -1) {
					path = outputfile02;
				} else if (displayPath.indexOf(parser.displayPath(includeSass02Folder03)) !== -1) {
					path = outputfile02;
				}
			}

			if (outputfile03.length > 0) {
				if (displayPath.indexOf(parser.displayPath(includeSass03Folder01)) !== -1) {
					path = outputfile03;
				} else if (displayPath.indexOf(parser.displayPath(includeSass03Folder02)) !== -1) {
					path = outputfile03;
				} else if (displayPath.indexOf(parser.displayPath(includeSass03Folder03)) !== -1) {
					path = outputfile03;
				}
			}

		} else if (prefs.getBoolPref('useFilewatcher')) {
			path = prefs.getCharPref('fileWatcher');
			base = path.substr(self._last_slash(path) + 1, path.lenght),
				buffer = self._readFile(path, '')[0];
		}

		if (!path) {
			path = filePath;
		} else {
			base = path.substr(self._last_slash(path) + 1, path.lenght);
			buffer = self._readFile(path, '')[0];
		}

		output.file = file;
		output.buffer = buffer;
		output.base = base;
		output.path = path;

		return output;
	}

	this._getPath = function(path) {
		if (prefs.getBoolPref('useFileScopes')) {

		} else if (prefs.getBoolPref('useFilewatcher')) {
			path = prefs.getCharPref('fileWatcher');
		}

		return path;
	}

	this._getBase = function(base) {
		if (prefs.getBoolPref('useFileScopes')) {

		} else if (prefs.getBoolPref('useFilewatcher')) {
			var path = prefs.getCharPref('fileWatcher');
			base = path.substr(self._last_slash(path) + 1, path.lenght);
		}

		return base;
	}

	this._getBuffer = function(buffer) {
		if (prefs.getBoolPref('useFileScopes')) {

		} else if (prefs.getBoolPref('useFilewatcher')) {
			var path = prefs.getCharPref('fileWatcher');
			buffer = self._readFile(path, '')[0];
		}

		return buffer;
	}

	this.enableFileWatcher = function() {
		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			path = (file) ? file.URI : null;
			

		if (!file) {
			notify.send(
			'SASS: Please save the file first',
				'tools'
			);
			return;  
		}
		
		if (file.ext == '.sass' || file.ext == '.scss') {
			if (prefs.getBoolPref('useFilewatcher') == false) {
				prefs.setBoolPref('useFilewatcher', true);
			}
			
			prefs.setCharPref('fileWatcher', path);
			notify.send(
			'SASS: file watcher enabled',
				'tools'
			);
			self._updateStatusBar();
		} else {
			notify.send(
			'SASS: Please select a SASS file',
				'tools'
			);
			self._updateStatusBar('SASS: Please select a SASS file');
			return;  
		}
	}
	
	this.disableFileWatcher = function(){
		if (prefs.getBoolPref('useFilewatcher')) {
			prefs.setBoolPref('useFilewatcher', false);
		}
		
		prefs.setCharPref('fileWatcher', '');
		notify.send(
			'SASS: file watcher disabled',
			'tools'
		);
		self._updateStatusBar();
	}
	
	this.enableCompiler = function() {
		prefs.setBoolPref('compilerEnabled', true);
		self._updateStatusBar();
		notify.send(
			'SASS: Compiler Enabled',
			'tools'
		);
	}

	this.disableCompiler = function() {
		prefs.setBoolPref('compilerEnabled', false);
		self._updateStatusBar();
		notify.send(
			'SASS: Compiler disabled',
			'tools'
		);
	}
	
	this._process_imports = function(imports, rootPath, fileExt) {
		
		var buffer = '',
		newContent = '',
		matchImports = /(@import\s*['"][^"';]+['"];|@import\s*[a-z0-9][^\s\t]+)/,
		matchValue = /[a-z0-9][^'"]+/i;
		
		if (imports !== -1) {
			imports.forEach(function(value, i){
				//if is regular @import
				var file = value;
				if (file.match(matchImports) !== null) {
					
					var fileName = file.replace(/(@import\s|["';]+)/gi, ''),
					
					fileName = fileName + fileExt;
					
					newContent = self._readFile(rootPath, fileName);
					buffer = buffer + newContent[0];
					
					if (buffer.toString().match(matchImports) !== null) {
						var cleanSass = self._strip_comments(buffer);
						newImport = self._split_on_imports(cleanSass);
						buffer = self._process_imports(newImport, newContent[1], fileExt);
					} 
					
				}
					
				//if isn't @import it's sass/css
				if (file.match(/@import\s*['"][^"';]+['"];/) == null && file.match(/@import\s*[a-z0-9][^\s\t]+/) == null) {
					buffer = buffer + file;
				}
			}); 
		} 
		
		return buffer;
	}
	
	this._get_imports = function(content){
		var cleanSassCss = self._strip_comments(content), 
			newImports = self._split_on_imports(cleanSassCss);
			return newImports;
	}
	
	this._process_sass = function(path, base, buffer, fileExt) {
		var rootPath = path.replace(base, ''),
			sassCss = String(buffer),
			SASS = '';
			
			sass_imports = self._get_imports(sassCss);
			SASS = self._process_imports(sass_imports, rootPath, fileExt);
			
			return SASS;
	}
	
	this._strip_comments = function(string) {
		var patern = /\/\/@import\s*['"][^"';]+['"];|\/\/@import\s*[a-z0-9][^\s\t@]+/gi;
		return string.toString().replace(patern , '' );
	}
	
	this._split_on_imports = function(cleansass){
		var patern = /(@import\s*['"][^"';]+['"];|@import\s*[a-z0-9][^\s\t@]+)/gi;
		return cleansass.split(patern);
	}

	this._saveFile = function(filepath, filecontent) {
		
		var file = Components
			.classes["@activestate.com/koFileEx;1"]
			.createInstance(Components.interfaces.koIFileEx);
		
		try {
			file.path = filepath;
			file.open('w');

			file.puts(filecontent);
			file.close();
		} catch(e){
			notify.send(
				'SASS ERROR: Saving file ' + filepath + ', Message: ' + e,
				'tools'
			);
		}

		return;
        
	};
	
	this._readFile = function(root, filepath, prefix = false) {

		var fileUrl,
			fileName,
			fullUrl = root + filepath,
			newRoot = '',
			backPatern = /(\.\.\/|\.\.\\)+/;

		//figure out ftp path if ../ in path
		if (filepath.search(backPatern) !== -1) {

			var output = self._parse_backDirectories(fullUrl, root, filepath),
				fileName = output.fileName,
				fileUrl = output.fileUrl;

		} else {
			var fileName = '';

			fileUrl = self._parse_uri(fullUrl);
			fileName = fileUrl.substring(self._last_slash(fileUrl) + 1, fileUrl.length);
		}

		newRoot = fileUrl.replace(fileName, '');

		var reader = Components.classes["@activestate.com/koFileEx;1"]
			.createInstance(Components.interfaces.koIFileEx),
			output = [],
			placeholder;
			
		if (sassData.needPrefixes !== undefined) {
			if (self._in_array(fileUrl, sassData.needPrefixes)) {
				prefix = true;
			}
		}
			
		if (prefix) {
			fileUrl = self._get_prefixd_url(fileUrl);
		}

		reader.path = fileUrl;

		try {
			reader.open("r");
			placeholder = reader.readfile();
			reader.close();
			output[0] = placeholder;
			output[1] = newRoot;

		} catch (e) {
			if (prefix === false) {
				output = self._readFile(root, filepath, true);
			} else {
				notify.send(
					'SASS ERROR: Reading file: ' + fileUrl,
					'tools'
				);
				self._updateStatusBar('SASS ERROR: Reading file: ' + fileUrl);
				console.error(e.message);
			}
			
		}

		return output;
	}
	
	this._getVars = function(buffer){
		var bufferVars = '',
			allVars,
			output = [];

		if (buffer.match(/\$[a-z0-9_-]+:/i)) {
			bufferVars = buffer.match(/\$[a-z0-9_-]+:[^;,\r\n]+/gi);
			allVars = bufferVars.toString().split(',');

			allVars.forEach(function(value, i) {
				var VarAndValues = value.split(':'),
					val = VarAndValues[0],
					comm = VarAndValues[1].replace(/^\s+/, '');
				if (!self._in_array(val, output)) {
					output.push({
						"value": val,
						"comment": comm
					});
				}
			})

			return JSON.stringify(output);
		}

	}

	this._getVarsFromBuffer = function() {
		d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			newVars = '',
			oldVars = sassData.vars;

		if (!d) {
			return false;
		}

		if (d.buffer.length > 0) {
			newVars = self._getVars(d.buffer);

			if (newVars.length > 0) {
				var allVars = oldVars.concat(newVars);
				sassData.vars = JSON.stringify(allVars);
			}

		}

		return false;
	}

	this._parse_backDirectories = function(fullUrl, root, filepath) {
		var url = self._parse_uri(fullUrl),
			urlParts = /\\/.test(root) ? root.split('\\') : root.split('/'),
			backDirectories = url.match(/(\.\.\/|\.\.\\)/g).length,
			fileName = filepath.toString().replace(/(\.\.\/|\.\.\\)+/, ''),
			$index = parseFloat(root.match(/(\/|\\)/g).length) - parseFloat(backDirectories),
			result = '',
			slash = /\\/.test(fullUrl) ? '\\' : '\/';

		for (index = 0; index < $index; ++index) {
			result = result + urlParts[index] + slash;
		}

		fileUrl = result.toString() + fileName;

		return {
			fileUrl: fileUrl,
			fileName: fileName
		};
	}

	this._in_array = function(search, array) {
		for (i = 0; i < array.length; i++) {
			if (array[i] == search) {
				return true;
			}
		}
		return false;
	}
	
	this._get_prefixd_url = function(uri){
		var base = uri.substr(0, self._last_slash(uri) + 1);
		var file = uri.substr((self._last_slash(uri) + 1), uri.length);
		var output = base + '_' + file;
		
		if (sassData.needPrefixes === undefined) {
			sassData.needPrefixes = [uri];
		} else {
			if (!self._in_array(uri, sassData.needPrefixes)) {
				sassData.needPrefixes.push(uri);
			}
		}
		
		return output;
	}

	this._last_slash = function(uri) {
		if (/\//.test(uri)) {
			return uri.lastIndexOf('/')
		} else {
			return uri.lastIndexOf('\\')
		}
	}

	this._parse_uri = function(uri) {
		if (/\\/.test(uri)) {
			uri = uri.replace(/\//g, '\\');
			ko.uriparse.getMappedPath(uri);
		}

		return uri;
	}

	this._cleanUp = function() {

		if (prefs.getBoolPref('showWarning')) {
			var features = "chrome,titlebar,toolbar,centerscreen";
			window.openDialog('chrome://sass/content/upgradeWarning.xul', "sassWarning", features);

			prefs.setBoolPref('showWarning', false);
		}

		if (prefs.getBoolPref('useFilewatcher') && !prefs.getBoolPref('useFileScopes')) {
			notify.send(
				'SASS: File watcher is still enabled form last session or is enabled in a other window.',
				'tools'
			);
		}
	}

	this._checkForSearch = function() {
		if (search) {
			self.getVars(true);
			search = false;
		}
	}

	this._updateView = function() {
		var wrapper = $('#sass_wrapper');
		if (wrapper.length > 0) {
			wrapper.remove();
		}

		self._updateStatusBar();
	}

	this._calculateXpos = function() {
		var currentWindowPos = editor.getCursorWindowPosition(),
			windowX = +currentWindowPos['x'],
			leftSidebarWith = +window.top.document.getElementById('workspace_left_area').clientWidth;

		return windowX - leftSidebarWith;
	}

	this._calculateYpos = function() {
		var currentWindowPos = editor.getCursorWindowPosition(),
			windowY = +currentWindowPos['y'],
			docH = +document.height,
			adjustY = +prefs.getIntPref('tooltipY'),
			leftH = +window.top.document.getElementById('workspace_left_area').clientHeight, //left pane
			menuH = +window.top.document.getElementById('toolbox_main').clientHeight, // top menu
			tabs = window.top.document.getElementById('tabbed-view')._tabs,
			tabsH = +tabs.clientHeight, //tabs height
			tabsT = +tabs.clientTop, //tabs ofsset top
			preCalc = docH - leftH + 1,
			topCalc = menuH + tabsH + preCalc + tabsT;

		topCalc = topCalc + adjustY;


		return windowY - topCalc;
	}

	insertSassVar = function() {
		var scimoz = ko.views.manager.currentView.scimoz,
			input = $('#sass_auto');

		if (input.length > 0) {
			var val = input.value();

			if (val.length > 0) {
				scimoz.insertText(scimoz.currentPos, val);
				scimoz.gotoPos(scimoz.currentPos + val.length);
			}
			input.parent().remove();
			ko.views.manager.currentView.setFocus();
		}
	}

	abortSassVarCompletion = function() {
		var comp = $('#sass_wrapper');

		if (comp.length > 0) {
			comp.remove();
			ko.views.manager.currentView.setFocus();
		}
	}

	blurSassComletion = function() {
		clearSassCompletion = setTimeout(function() {
			abortSassVarCompletion();
		}, 1000);
	}

	focusSassCompletion = function() {
		if (typeof clearSassCompletion !== 'undefined') {
			clearTimeout(clearSassCompletion);
		}
	}

	this._autocomplete = function() {
		var completions = sassData.vars,
			popup = document.getElementById('sass_wrapper'),
			autocomplete = document.createElement('textbox'),
			x = self._calculateXpos(),
			y = self._calculateYpos();

		if (popup == null) {
			popup = document.createElement('tooltip');
			popup.setAttribute('id', 'sass_wrapper');
			autocomplete.setAttribute('id', 'sass_auto');
			autocomplete.setAttribute('type', 'autocomplete');
			autocomplete.setAttribute('showcommentcolumn', 'true');
			autocomplete.setAttribute('autocompletesearch', 'sass-autocomplete');
			autocomplete.setAttribute('highlightnonmatches', 'true');
			autocomplete.setAttribute('ontextentered', 'insertSassVar()');
			autocomplete.setAttribute('ontextreverted', 'abortSassVarCompletion()');
			autocomplete.setAttribute('minresultsforpopup', '0');
			autocomplete.setAttribute('onblur', 'blurSassComletion()');
			autocomplete.setAttribute('onfocus', 'focusSassCompletion()');
			popup.appendChild(autocomplete);

			document.documentElement.appendChild(popup);
		}

		if (typeof completions === 'undefined') {
			notify.send(
				'No vars set, going find some!',
				'tools'
			);
			self._getVars();
			return false;
		}


		if (completions.length > 0) {
			autocomplete.setAttribute('autocompletesearchparam', completions);
			popup.openPopup(ko.views.manager.currentView, "after_pointer", x, y, false, false);
			autocomplete.focus();
			autocomplete.value = "$";
			autocomplete.open = true;
		}

	}

	this._updateStatusBar = function(message, error) {
		message = message || false;
		error = error || false;
		var label = 'Compiler Enabled',
			compileEnabled = prefs.getBoolPref('compilerEnabled'),
			attachTo = $("#statusbar-encoding");

		if (ko.views.manager.currentView == 'undefined') {
			return false;
		}

		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file;

		if (!file) {
			return;
		}

		if (file.ext === '.sass' || file.ext === '.scss') {
			if ($("#statusbar-eol").length > 0) {
				attachTo = $("#statusbar-eol");
			}

			$("#statusbar-sass").remove();

			if (prefs.getBoolPref('useFileScopes')) {
				var path = 'Outside file scope',
					filePath = (file) ? file.URI : null,
					outputfile01 = prefs.getCharPref('outputfile01'),
					outputfile02 = prefs.getCharPref('outputfile02'),
					outputfile03 = prefs.getCharPref('outputfile03'),
					includeSass01Folder01 = prefs.getCharPref('includeSass01Folder01').length > 0 ? prefs.getCharPref('includeSass01Folder01') : null,
					includeSass01Folder02 = prefs.getCharPref('includeSass01Folder02').length > 0 ? prefs.getCharPref('includeSass01Folder02') : null,
					includeSass01Folder03 = prefs.getCharPref('includeSass01Folder03').length > 0 ? prefs.getCharPref('includeSass01Folder03') : null,
					includeSass02Folder01 = prefs.getCharPref('includeSass02Folder01').length > 0 ? prefs.getCharPref('includeSass02Folder01') : null,
					includeSass02Folder02 = prefs.getCharPref('includeSass02Folder02').length > 0 ? prefs.getCharPref('includeSass02Folder02') : null,
					includeSass02Folder03 = prefs.getCharPref('includeSass02Folder03').length > 0 ? prefs.getCharPref('includeSass02Folder03') : null,
					includeSass03Folder01 = prefs.getCharPref('includeSass03Folder01').length > 0 ? prefs.getCharPref('includeSass03Folder01') : null,
					includeSass03Folder02 = prefs.getCharPref('includeSass03Folder02').length > 0 ? prefs.getCharPref('includeSass03Folder02') : null,
					includeSass03Folder03 = prefs.getCharPref('includeSass03Folder03').length > 0 ? prefs.getCharPref('includeSass03Folder03') : null,
					parser = ko.uriparse,
					displayPath = parser.displayPath(filePath);

				if (outputfile01.length > 0) {
					if (displayPath.indexOf(parser.displayPath(includeSass01Folder01)) !== -1) {
						path = outputfile01;
					} else if (displayPath.indexOf(parser.displayPath(includeSass01Folder02)) !== -1) {
						path = outputfile01;
					} else if (displayPath.indexOf(parser.displayPath(includeSass01Folder03)) !== -1) {
						path = outputfile01;
					} else if (displayPath.indexOf(parser.displayPath(outputfile01)) !== -1) {
						path = outputfile01;
					}
				}

				if (outputfile02.length > 0) {
					if (displayPath.indexOf(parser.displayPath(includeSass02Folder01)) !== -1) {
						path = outputfile02;
					} else if (displayPath.indexOf(parser.displayPath(includeSass02Folder02)) !== -1) {
						path = outputfile02;
					} else if (displayPath.indexOf(parser.displayPath(includeSass02Folder03)) !== -1) {
						path = outputfile02;
					} else if (displayPath.indexOf(parser.displayPath(outputfile02)) !== -1) {
						path = outputfile02;
					}
				}

				if (outputfile03.length > 0) {
					if (displayPath.indexOf(parser.displayPath(includeSass03Folder01)) !== -1) {
						path = outputfile03;
					} else if (displayPath.indexOf(parser.displayPath(includeSass03Folder02)) !== -1) {
						path = outputfile03;
					} else if (displayPath.indexOf(parser.displayPath(includeSass03Folder03)) !== -1) {
						path = outputfile03;
					} else if (displayPath.indexOf(parser.displayPath(outputfile03)) !== -1) {
						path = outputfile03
					}
				}

				if (path !== null) {
					if (path.length > 40) {
						path = '...' + path.substr(path.length - 40, path.length);
					}
					label = 'File Scope: ' + path;
				}


			} else if (prefs.getBoolPref('useFilewatcher')) {
				var fileWatcher = prefs.getCharPref('fileWatcher');

				if (fileWatcher.length > 40) {
					fileWatcher = '...' + fileWatcher.substr(fileWatcher.length - 40, fileWatcher.length);
				}
				label = 'File Watcher: ' + fileWatcher;
			}

			if (message) {
				label = message;
			}

			if (!compileEnabled) {
				label = 'Compiler Disabled';
			}

			var statPanel = document.createElement('statusbarpanel');

			statPanel.setAttribute('id', 'statusbar-sass');
			statPanel.setAttribute('tooltiptext', 'SASS Settings');

			attachTo.before(statPanel);
			var menu = document.createElement('menupopup'),
				enableDisable = document.createElement('menuitem'),
				fileWatcherItem = document.createElement('menuitem'),
				settingsItem = document.createElement('menuitem'),
				fileScopes = document.createElement('menuitem');

			if (!compileEnabled) {
				enableDisable.setAttribute('label', 'Enable Compiler');
				enableDisable.setAttribute('oncommand', 'extensions.sass.enableCompiler()');
			} else {
				enableDisable.setAttribute('label', 'Disable Compiler');
				enableDisable.setAttribute('oncommand', 'extensions.sass.disableCompiler()');
			}

			if (prefs.getBoolPref('useFilewatcher')) {
				fileWatcherItem.setAttribute('label', 'Disable File Watcher');
				fileWatcherItem.setAttribute('oncommand', 'extensions.sass.disableFileWatcher();');
			} else {
				fileWatcherItem.setAttribute('label', 'Enable File Watcher');
				fileWatcherItem.setAttribute('oncommand', 'extensions.sass.enableFileWatcher();');
			}

			fileScopes.setAttribute('label', 'File Scopes'),
				fileScopes.setAttribute('oncommand', 'extensions.sass.OpenSassFileScopes();');

			settingsItem.setAttribute('label', 'Settings'),
				settingsItem.setAttribute('oncommand', 'extensions.sass.OpenSassSettings();');

			menu.appendChild(enableDisable);
			menu.appendChild(fileWatcherItem);
			menu.appendChild(fileScopes);
			menu.appendChild(settingsItem);

			var panel = document.getElementById('statusbar-sass'),
				button = document.createElement('toolbarbutton');

			button.setAttribute('class', 'statusbar-label');
			button.setAttribute('id', 'statusbar-sass-label');
			button.setAttribute('flex', '1');
			button.setAttribute('orient', 'horizontal');
			button.setAttribute('type', 'menu');
			button.setAttribute('persist', 'buttonstyle');
			button.setAttribute('buttonstyle', 'text');
			button.setAttribute('label', label);

			panel.appendChild(button);

			var button = document.getElementById('statusbar-sass-label');
			button.appendChild(menu);

		} else {
			$("#statusbar-sass").remove();
		}

	}

	this.varCompletion = function() {
		var editor_pane = ko.views.manager.topView;

		this._onKeyPress = function(e) {
			if (!editor_pane.currentView) {
				return;
			}
			
			var scimoz = ko.views.manager.currentView.scimoz;
			if (e.shiftKey && e.charCode == 36) {
				var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
					file = d.file;

				if (!file) {
					notify.send(
						'Please save the file first',
						'tools'
					);
					return;
				}

				if (file.ext == '.sass' || file.ext == '.scss') {
					var currentLine = scimoz.lineFromPosition(scimoz.currentPos),
						currentLineStart = scimoz.lineLength(currentLine);

					try {
						if (currentLineStart > 3) {
							e.preventDefault();
							e.stopPropagation();
							self._autocomplete();
						} else {
							search = true;
						}
					} catch (e) {

					}
				}
			}
		}


		editor_pane.addEventListener('keypress', self._onKeyPress, true);
	}
	var features = "chrome,titlebar,toolbar,centerscreen";
	this.OpenSassSettings = function() {
		window.openDialog('chrome://sass/content/pref-overlay.xul', "sassSettings", features);
	}

	this.OpenSassFileScopes = function() {
		var windowVars = {
			ko: ko,
			sassData: sassData,
			prefs: prefs,
			overlay: self,
			notify: notify,
		};
		window.openDialog('chrome://sass/content/fileScopes.xul', "sassFileScopes", features, windowVars);
	}

	this._AfterSafeAction = function() {
		self._checkForSearch();
		self.compileFile(false, prefs.getBoolPref('compressFile'));
	}

	this._StartUpAction = function() {
		self._cleanUp();
		self.varCompletion();
	}

	this._focusAction = function() {
		self._updateStatusBar();
	}

	window.addEventListener("komodo-post-startup", self._StartUpAction, false);
	window.addEventListener("view_opened", self.getVars, false);
	window.addEventListener("focus", self._focusAction, false);
	window.addEventListener("file_saved", self._AfterSafeAction, false);
	window.addEventListener("current_view_changed", self._updateView, false);
}).apply(extensions.sass);
