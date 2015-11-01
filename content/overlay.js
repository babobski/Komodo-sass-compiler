xtk.load('chrome://sass/content/sass/sass.js');

/**
 * Namespaces
 */
if (typeof(extensions) === 'undefined') extensions = {};
if (typeof(extensions.sass) === 'undefined') extensions.sass = { version : '1.2.2' };

(function() {
	var self = this,
		notify	= require("notify/notify"),
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
		
		window.removeEventListener("komodo-post-startup", self._cleanUp, false);
	}
		
	this.compileFile = function(showWarning, compress, getVars) {
		showWarning = showWarning || false;
		compress = compress || false;
		getVars = getVars || false;

		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc,
			file = d.file,
			buffer = d.buffer,
			base = (file) ? file.baseName : null,
			path = (file) ? file.URI : null;

		if (!file || !path) {
			if (! getVars) {
				notify.send(
					'SASS: Please save the file first',
					'tools'
				);	
			}
			return;  
		}
		
		if (file.ext == '.sass' || file.ext == '.scss') {
			
			if (getVars) {
				notify.send(
					'SASS: Getting SASS vars',
					'tools'
				);	
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
					} else {
						notify.send(
							'SASS ERROR: ' + result.message,
							'tools'
						);	
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
			} else {
				notify.send(
					'SASS ERROR: ' + result.message,
					'tools'
				);
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
			} else {
				notify.send(
					'SASS ERROR: ' + result.message,
					'tools'
				);
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
		} else {
			notify.send(
			'SASS: Please select a SASS file',
				'tools'
			);
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
					
					newContent = self._readFile(rootPath,  fileName);
					buffer = buffer + newContent[0];
					
					if (buffer.toString().match(matchImports) !== null) {
						var cleanSass = self._strip_comments(buffer);
						newImport = self._split_on_imports(cleanSass);
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
			notify.send(
				'SASS ERROR: Reading file: ' + fileUrl,
				'tools'
			);
		}
		
		return output;
	}
	
	this._getVars = function(buffer){
		var bufferVars = '',
			allVars,
			output = [];
		
		if (buffer.match(/\$[a-z0-9]+:/i)) {
			bufferVars = buffer.match(/\$[a-z0-9]+:/gi);
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
			var features = "chrome,titlebar,toolbar,centerscreen,modal";
			window.openDialog('chrome://sass/content/fileWatcher.xul', "removeFileWatcher", features, self);
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
					notify.send(
					'Please save the file first',
						'tools'
					);
					return;  
				}
				
				if (file.ext == '.sass' || file.ext == '.scss') {
					var currentLine = scimoz.lineFromPosition(scimoz.currentPos),
					currentLineStart = scimoz.lineLength(currentLine);
					if (currentLineStart > 3) {
                        e.preventDefault();
						e.stopPropagation();
						
						scimoz.replaceSel('');
					 
						if (typeof completions !== 'undefined' && completions.length > 0) {
							completions = completions.sort();
						} else {
							notify.send(
								'No vars set, going find some!',
									'tools'
								);
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
				
				scimoz.beginUndoAction()
				try {
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
						
						currentChar = scimoz.getWCharAt(scimoz.currentPos).toString();
						switch (currentChar) {
							case ';':
								scimoz.charRight();
								scimoz.deleteBackNotLine();
								break;
							case ')':
								scimoz.charRight();
								scimoz.deleteBackNotLine();
								break;
							case ',':
								scimoz.charRight();
								scimoz.deleteBackNotLine();
								break;
							default:
								scimoz.charLeft();
								break;
						}
					}
				} finally {
					scimoz.endUndoAction()
				}
			}
		};
		editor_pane.addEventListener('keypress', self._onKeyPress, true);
	}
	
	window.addEventListener("komodo-post-startup", self._cleanUp, false);
}).apply(extensions.sass);
