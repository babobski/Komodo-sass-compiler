// tools for common Komodo extension chores
xtk.load('chrome://sass/content/toolkit.js');
// Komodo console in Output Window
xtk.load('chrome://sass/content/konsole.js');
xtk.load('chrome://sass/content/sass/sass.js');

/**
 * Namespaces
 */
if (typeof(extensions) === 'undefined') extensions = {};
if (typeof(extensions.sass) === 'undefined') extensions.sass = { version : '2.5.0' };

(function() {
	var self = this,
		prefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService).getBranch("extensions.sass.");
		
	if (!('sass' in ko)) ko.extensions = {}; 
	var myExt = "SassCompiler@babobski.com" ; 
	if (!(myExt in ko.extensions)) ko.extensions[myExt] = {};
	if (!('myapp' in ko.extensions[myExt])) ko.extensions[myExt].myapp = {};
	var sassData = ko.extensions[myExt].myapp;
	
	if (extensions.sass && extensions.sass.onKeyPress)
	{
		ko.views.manager.topView.removeEventListener(
			'keypress',
			extensions.sass._onKeyPress, true
		);
		
		ko.views.manager.topView.removeEventListener(
			'onload',
			extensions.sass._cleanUp(), true
		);
	}
		
	this.compileFile = function(showWarning, compress, getVars) {
		showWarning = showWarning || false;
		compress = compress || false;
		getVars = getVars || false;

		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			buffer = d.buffer,
			base = file.baseName,
			path = (file) ? file.URI : null;

		if (!file) {
			self._log('Please save the file first', konsole.S_ERROR);
			return;  
		}
		
		if (file.ext == '.sass' || file.ext == '.scss') {
			
			if (getVars) {
				self._log('Getting SASS vars', konsole.S_LESS);
				if (prefs.getBoolPref('showMessages') == false && prefs.getBoolPref('showNotVars')) {
					self._notifcation('Getting SASS vars');
				}
			} else {
				self._log('Compiling SASS file', konsole.S_SASS);
			}
			
			if (prefs.getBoolPref('useFilewatcher')) {
				path = prefs.getCharPref('fileWatcher');
				base = path.substr(path.lastIndexOf('/') + 1, path.lenght),
				buffer = self._readFile(path, '')[0];
			}
		
			outputSass = self._process_sass(path, base, buffer, file.ext);
			if (getVars) {
				var allVars = self._getVars(outputSass);
				sassData.vars = allVars;
				if (sassData.vars !== undefined) {
					self._log(sassData.vars, konsole.S_OK);
				} else {
					sassData.vars = [ "@No_vars_found" ];
					if (prefs.getBoolPref('showMessages')) {
						self._log('No SASS vars found', konsole.S_ERROR);
					} else {
						self._notifcation('No SASS vars found', true);
					}
				}
				
			} else {
				var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
				SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
				treatAsSass = file.ext == '.sass' ? true : false;
				
				sass.compile(outputSass, {  style: SassStyle, indentedSyntax: treatAsSass }, function(result){
					if (result.status == 0) {
						var newFilename = path.replace(file.ext, '.css');
						self._saveFile(newFilename, result.text);
						self._log('File saved', konsole.S_OK);
						if (prefs.getBoolPref('showMessages') == false && prefs.getBoolPref('showNotSave')) {
						self._notifcation( 'SASS File saved');
					}
					} else {
						if (prefs.getBoolPref('showMessages')) {
							self._log('ERROR message ' + result.message, konsole.S_ERROR);
						} else {
							self._notifcation(result.message, true);
						}
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
			base = file.baseName,
			path = (file) ? file.URI : null;
			
		self._log('Compile SASS buffer', konsole.S_SASS);
		if (prefs.getBoolPref('showMessages') == false) {
			self._notifcation('Compile SASS buffer');
		}
		
		outputSass = self._process_sass(path, base, buffer, file.ext);
		
		var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
		SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
		treatAsSass = file.ext == '.sass' ? true : false;
		
		sass.compile(outputSass, {  style: SassStyle, indentedSyntax: treatAsSass }, function(result){
			if (result.status == 0) {
				d.buffer = result.text;
			} else {
				if (prefs.getBoolPref('showMessages')) {
					self._log('ERROR message ' + result.message, konsole.S_ERROR);
				} else {
					self._notifcation(result.message, true);
				}
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
			base = file.baseName,
			path = (file) ? file.URI : null;
			
		self._log('Compiling SASS selection', konsole.S_SASS);
		if (prefs.getBoolPref('showMessages') == false) {
			self._notifcation('Compiling SASS selection');
		}
	
		outputSass = self._process_sass(path, base, text, file.ext);
		
		var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
		SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
		treatAsSass = file.ext == '.sass' ? true : false;
		
		sass.compile(outputSass, {  style: SassStyle, indentedSyntax: treatAsSass }, function(result){
			if (result.status == 0) {
				var sass = result.text;
				scimoz.replaceSel(sass);
			} else {
				if (prefs.getBoolPref('showMessages')) {
					self._log('ERROR message ' + result.message, konsole.S_ERROR);
				} else {
					self._notifcation(result.message, true);
				}
			}
		});
	};

	this.compileCompressSelection = function() {
		this.compileSelection(true);
	}
	
	this.getVars = function(){
		this.compileFile(false, false, true);
	}
	
	this.enableFileWatcher = function(){
		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			path = (file) ? file.URI : null;
			

		if (!file) {
			if (prefs.getBoolPref('showMessages')) {
				self._log('Please save the file first', konsole.S_ERROR);
			} else {
				self._notifcation('Please save the file first', true);
			}
			
			return;  
		}
		
		if (file.ext == '.sass' || file.ext == '.scss') {
			if (prefs.getBoolPref('useFilewatcher') == false) {
				prefs.setBoolPref('useFilewatcher', true);
			}
			
			prefs.setCharPref('fileWatcher', path);
			self._log('file watcher enabled', konsole.S_OK);
			if (prefs.getBoolPref('showMessages') == false) {
				self._notifcation("file watcher enabled");
			}
		} else {
			if (prefs.getBoolPref('showMessages')) {
				self._log('Please select a SASS file', konsole.S_ERROR);
			} else {
				self._notifcation('Please save the file first', true);
			}
			return;  
		}
	}
	
	this.disableFileWatcher = function(){
		if (prefs.getBoolPref('useFilewatcher')) {
			prefs.setBoolPref('useFilewatcher', false);
		}
		
		prefs.setCharPref('fileWatcher', '');
		self._log('file watcher disabled', konsole.S_OK);
		if (prefs.getBoolPref('showMessages') == false) {
			self._notifcation("file watcher disabled");
		}
	}
	
	this._process_imports = function(imports, rootPath, fileExt) {
		
		var buffer = '',
		newContent = '',
		matchImports = /(@import\s*['"][^"';]+['"];|@import\s*[a-z0-9][^\s\t]+)/,
		matchValue = /[a-z0-9][^"]+/i;
		
		if (imports !== -1) {
			imports.forEach(function(value, i){
				//if is regular @import
				var file = value;
				if (file.match(matchImports) !== null) {
					
					var fileName = file.replace(/(@import\s|["';]+)/gi, ''),
					
					fileName = fileName + fileExt;
					
					self._log('@import ' + fileName, konsole.S_CUSTOM);
					newContent = self._readFile(rootPath,  fileName);
					buffer = buffer + newContent[0];
					
					if (buffer.toString().match(matchImports) !== null) {
						var cleanLess = self._strip_comments(buffer);
						newImport = self._split_on_imports(cleanLess);
						buffer = self._process_imports(newImport, newContent[1]);
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
		var cleanLess = self._strip_comments(content), 
			newImports = self._split_on_imports(cleanLess);
			return newImports;
	}
	
	this._process_sass = function(path, base, buffer, fileExt) {
		var rootPath = path.replace(base, ''),
			lessCss = String(buffer),
			SASS = '';
			
			less_imports = self._get_imports(lessCss);
			SASS = self._process_imports(less_imports, rootPath, fileExt);
			
			return SASS;
	}
	
	this._strip_comments = function(string) {
		var patern = /\/\/@import\s*['"][^"';]+['"];|\/\/@import\s*[a-z0-9][^\s\t]+/gi;
		return string.toString().replace(patern , '' );
	}
	
	this._split_on_imports = function(cleanless){
		var patern = /(@import\s*['"][^"';]+['"];|@import\s*[a-z0-9][^\s\t]+)/gi;
		return cleanless.split(patern);
	}

	this._saveFile = function(filepath, filecontent) {
		self._log('Saving file to ' + filepath, konsole.S_CUSTOM);

		var file = Components
			.classes["@activestate.com/koFileEx;1"]
			.createInstance(Components.interfaces.koIFileEx);
		file.path = filepath;

		file.open('w');

		file.puts(filecontent);
		file.close();

		return;
	};
	
	this._readFile = function (root, filepath, level = 0) {
		
		var fileUrl,
			fullUrl = root + filepath,
			newRoot = '',
			backPatern = /[.][.][/]+/;
		
		//figure out ftp path if ../ in path
		if (filepath.search(backPatern) !== -1 ) {
			
			var	url = fullUrl,
				urlParts = root.split('/'),
				backDirectories = url.match(/[[./]+/).length - 1,
				fileName = url.substr(url.lastIndexOf('/') + 1, url.lenght),
				$index =  parseFloat(root.match(/[/]+/g).length) - parseFloat(backDirectories),
				result = '';
				
				for (index = 0; index < $index; ++index) {
					result = result + urlParts[index] + '/';
				}
				
				fileUrl = result.toString() + fileName;
			
		} else {
			var fileName = '';
			
			fileUrl = fullUrl;
			fileName = fileUrl.substring(fileUrl.lastIndexOf('/') + 1, fileUrl.length);
		}
		
		newRoot = fileUrl.replace(fileName, '');

		var reader = Components.classes["@activestate.com/koFileEx;1"]
                    .createInstance(Components.interfaces.koIFileEx),
					output = [];
		
		reader.path = fileUrl;
		
		try {
			reader.open("r");
			output[0] = reader.readfile();
			reader.close();
			output[1] = newRoot;
		} catch(e){
			if (prefs.getBoolPref('showMessages')) {
				self._log('ERROR Reading file: ' + fileUrl, konsole.S_ERROR);
			} else {
				self._notifcation('ERROR Reading file: ' + fileUrl, true);
			}
		}
		
		return output;
	}

	this._log = function(message, style) {
		if (style == konsole.S_ERROR || prefs.getBoolPref('showMessages')) {
			konsole.popup();
			konsole.writeln('[SASS] ' + message, style);
		}
	};
	
	this._notifcation = function($message){
		$message =$message || false;
		error = error || false;
		
		var icon = error ? 'chrome://sass/content/sass-error-icon.png' : 'chrome://sass/content/sass-icon.png';
		if (!("Notification" in window)) {
		  alert("This browser does not support system notifications");
		}
		else if (Notification.permission === "granted") {
		  var options = {
			body: $message,
			icon: 'chrome://sass/content/sass-icon.png'
		  }
		  var n = new Notification('SASS Compiler', options);
		  setTimeout(n.close.bind(n), 5000); 
		}
	  
		else if (Notification.permission !== 'denied') {
		  Notification.requestPermission(function (permission) {
			if (permission === "granted") {
				var options = {
				   body: $message,
				   icon: 'chrome://sass/content/sass-icon.png'
				 }
				 var n = new Notification('SASS Compiler', options);
				setTimeout(n.close.bind(n), 5000); 
			}
		  });
		}
	}
	
	this._getVars = function(buffer){
		var bufferVars = '',
			allVars,
			output = [];
		
		if (buffer.match(/[$][a-z0-9]+:/i)) {
			bufferVars = buffer.match(/[$][a-z0-9]+:/gi);
			allVars = bufferVars.toString().split(',');
			
			allVars.forEach(function(value, i){
				var val = value.replace(/[:,]+/g, '');
				if (!self._in_array(val, output)) {
					output.push(val);	
				}
			})
			
			return output;
		}
		
	}
	
	this._in_array = function (search, array) {
		for (i = 0; i < array.length; i++) {
			if(array[i] ==search ) {
				return true;
			}
		}
		return false;
	}
	
	this._cleanUp = function() {
		if (prefs.getBoolPref('useFilewatcher')) {
			self.disableFileWatcher();
		}
	}
	
	this.varCompletion = function(){
		var editor_pane = ko.views.manager.topView;
		var inserted = false;
		
		this._onKeyPress = function(e)
		{
			var scimoz = ko.views.manager.currentView.scimoz;
			var sep = String.fromCharCode(scimoz.autoCSeparator);
			var completions = sassData.vars;
			
			if (scimoz.autoCMaxHeight !== 10) {
				scimoz.autoCMaxHeight = 10;
			}
			
			if (e.shiftKey && e.charCode == 36)		
			{
				var  d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
				file = d.file;
				
				if (!file) {
					if (prefs.getBoolPref('showMessages')) {
						self._log('Please save the file first', konsole.S_ERROR);
					} else {
						self._notifcation('Please save the file first', true);
					}
					return;  
				}
				
				if (file.ext == '.sass' || file.ext == '.scss') {
					var currentLine = scimoz.lineFromPosition(scimoz.currentPos),
					currentLineStart = scimoz.lineLength(currentLine);
					e.preventDefault();
					e.stopPropagation();
					
					scimoz.replaceSel('');
				 
					if (typeof completions !== 'undefined' && completions.length > 0) {
						completions = completions.sort();
					} else {
						if (prefs.getBoolPref('showMessages')) {
							self._log("No vars set, going find some!", konsole.S_WARNING);
						}
						self.getVars();
						return false;
					}
					scimoz.insertText(scimoz.currentPos, '$');
					scimoz.charRight();
					setTimeout(function(){
						scimoz.autoCShow(1, completions.join(sep));
						inserted = true;
					}, 200);
				}
			}
			
			
			//remove unwanted white space and ; 
			if (e.charCode == 59 && inserted == true) {
				var  d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
				file = d.file;
				
				if (file.ext == '.sass' || file.ext == '.scss') {
					inserted = false;
					this.removeWhiteSpace();
				}
			}
		
			//trigger on )
			if (e.charCode == 41 && inserted == true) {
				var  d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
				file = d.file;
				
				if (file.ext == '.sass' || file.ext == '.scss') {
					inserted = false;
					this.removeWhiteSpace();
				}
			}
			
			this.removeWhiteSpace = function () {
				var current_line = scimoz.lineFromPosition(scimoz.currentPos);
				scimoz.charLeft();
				if (/\s/.test(scimoz.getWCharAt(scimoz.currentPos))) {
					scimoz.charRight();
					scimoz.deleteBackNotLine();
					scimoz.charLeft();
				} 
				
				if (/\s/.test(scimoz.getWCharAt(scimoz.currentPos))) {
					this.removeWhiteSpace();
				} else {
					scimoz.charRight();
					while (/[\t\s]/.test(scimoz.getWCharAt(scimoz.currentPos).toString()) && current_line == scimoz.lineFromPosition(scimoz.currentPos)) {
						scimoz.charRight();
						scimoz.deleteBackNotLine();
					}
					
					switch (scimoz.getWCharAt(scimoz.currentPos).toString()) {
						case ';':
							scimoz.charRight();
							scimoz.deleteBackNotLine();
							break;
						case ')':
							scimoz.charRight();
							scimoz.deleteBackNotLine();
							break;
						default:
							scimoz.charLeft();
							break;
					}
				}
			}
		};
		editor_pane.addEventListener('keypress', self._onKeyPress, true);
	}
	
	ko.views.manager.topView.addEventListener('onload', self._cleanUp(), true);
}).apply(extensions.sass);
