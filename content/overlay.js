xtk.load('chrome://sass/content/sass/sass.js');
xtk.load('chrome://sass/content/helper.js');

/**
 * Namespaces
 */
if (typeof(extensions) === 'undefined') extensions = {};
if (typeof(extensions.sass) === 'undefined') extensions.sass = {
	version: '2.4'
};
(function() {
	var notify = require("notify/notify"),
		$ = require("ko/dom"),
		self = this,
		search = false,
		notification = false,
		editor = require("ko/editor"),
		parse = ko.uriparse,
		helper = new Helper(),
		prefs = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService).getBranch("extensions.sass.");


	if (!('extensions' in	ko)) ko.extensions = {};
	var myExt = "SassCompiler@komodoeditide.com";
	if (!(myExt in ko.extensions)) ko.extensions[myExt] = {};
	if (!('myapp' in ko.extensions[myExt])) ko.extensions[myExt].myapp = {};
	var sassData = ko.extensions[myExt].myapp;

	if (extensions.sass && extensions.sass.onKeyPress) {
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

		var d = ko.views.manager.currentView.document || ko.views.manager.currentView.koDoc;
		if (d === null || d.file === null) {
			return false;
		}
		
		var fileExt = d.file.ext;
		if (fileExt == '.sass' || fileExt == '.scss') {
			var	fileContent = self._getContent(d, getVars),
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
		
			if (getVars) {
				self._notifcation('SASS: Getting SASS vars');
			} 
		
			outputSass = self._process_sass(path, base, buffer, file.ext);
			if (getVars) {
				var allVars = self._getVars(outputSass);
				sassData.vars = allVars;
				if (sassData.vars === undefined) {
					sassData.vars = [ "$No_vars_found" ];
					self._notifcation('SASS: No SASS vars found');
				}
				
			} else {
				var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
				SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
				treatAsSass = file.ext == '.sass' ? true : false;
				
				sass.compile(outputSass, {	style: SassStyle, indentedSyntax: treatAsSass, comments: false }, function(result){
					if (result.status == 0) {
						var newFilename = path.replace(file.ext, '.css');
						self._saveFile(newFilename, result.text);
						self._notifcation('SASS: File saved');
						self._updateStatusBar();
					} else {
						self._notifcation('SASS ERROR: ' + result.message, true);
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
			self._notifcation('SASS: Please save the file first', true);
			return;	
		}
		
		outputSass = self._process_sass(path, base, buffer, file.ext);
		
		var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
		SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
		treatAsSass = file.ext == '.sass' ? true : false;
		
		sass.compile(outputSass, {	style: SassStyle, indentedSyntax: treatAsSass }, function(result){
			if (result.status == 0) {
				d.buffer = result.text;
				self._notifcation('SASS: Compiled SASS buffer');
				self._updateStatusBar();
			} else {
				self._notifcation('SASS ERROR: ' + result.message, true);
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
				self._notifcation('SASS: Please save the file first', true);	
				return;	
			}
			
	
		outputSass = self._process_sass(path, base, text, file.ext);
		
		var sass = new Sass('chrome://sass/content/sass/sass.worker.js');
		SassStyle = compress == true ? Sass.style.compressed : Sass.style.nested;
		treatAsSass = file.ext == '.sass' ? true : false;
		
		sass.compile(outputSass, {	style: SassStyle, indentedSyntax: treatAsSass }, function(result){
			if (result.status == 0) {
				var sass = result.text;
				scimoz.replaceSel(sass);
				self._notifcation('SASS: Compiled SASS selection');
				self._updateStatusBar();
			} else {
				self._notifcation('SASS ERROR: ' + result.message, true);
				self._updateStatusBar('SASS ERROR: ' + result.message);
				console.error('SASS ERROR: ' + result.formatted);
			}
		});
	};

	this.compileCompressSelection = function() {
		this.compileSelection(true);
	}
	
	this.compileMultipleFiles = function(scope, getVars) {
		scope = scope || false;
		getVars = getVars || false;
		var compilerEnabled = prefs.getBoolPref('compilerEnabled'),
		compress = prefs.getBoolPref('compressFile');

		if (!compilerEnabled || !scope) {
			return;
		}
		
		var outputFiles = scope.outputfiles,
			base = scope.projectDir,
			proccesedSass = [];
		
		for (var w = 0; w < outputFiles.length; w++) {
			var outputfile = outputFiles[w],
				path = base + outputfile,
				proccesedFile = {};
				
			newBase = path.substr((self._last_slash(path) + 1), path.length);
			
			var buffer = self._readFile(path, '')[0],
			
			outputSass = self._proces_sass(path, newBase, buffer);
			proccesedFile.path = path;
			proccesedFile.output = outputSass;
			proccesedSass.push(proccesedFile);
		}
		
		if (getVars) {
			self._notifcation('SASS: Getting SASS vars');
			
			for (var i = 0 ; i < proccesedSass.length; i++) {
				output = proccesedSass[i].output;
				var allVars = self._getVars(output);
				sassData.vars = allVars;
				self._getVars(output);
			}
			
			if (sassData.vars === undefined){
				sassData.vars = '';
				self._notifcation('SASS: No SASS vars found');
			}
		} else {
			var counter = 0;
			var running = false;
			var procesSass = setInterval(function(){
				if (!running) {
					running = true;
					var procestFile = proccesedSass[counter];
					sass.render(procestFile.output, {
						compress: compress,
						async: false,
					})
					.then(function(output) {
						var newFilename = procestFile.path.replace('.sass', '.css');
						self._saveFile(newFilename, output.css);
						running = false;
						
						
						self._updateStatusBar();
						
					},
					function(error) {
						self._notifcation('SASS ERROR: ' + error, true);
						self._updateStatusBar('SASS ERROR: ' + error);
						running = false;
					});
					counter++;
					if (counter === proccesedSass.length) {
						self._notifcation('SASS: ' + counter + ' Files saved');
						clearInterval(procesSass);
					}
				}
			}, 100);
		}
	};

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

	this._getContent = function(doc, getVars) {
		var file = doc.file,
			buffer = doc.buffer,
			base = (file) ? file.baseName : null,
			filePath = (file) ? file.URI : null,
			scopes = [],
			path = '',
			getVars = getVars || false,
			output = {};


		if (prefs.getBoolPref('useFileScopes')) {
			var parser = ko.uriparse,
				displayPath = parser.displayPath(filePath),
				projectDir;
			var fileScopes = prefs.getCharPref('fileScopes');
			var parsedScopes = JSON.parse(fileScopes);
			var currentProject = ko.projects.manager.currentProject;
			var matchedScopes = [];
			
			if (currentProject === null) {
				notify.send('No current project', 'Tools');
				path = displayPath;
			} else {
				var currentProjectName = currentProject.name.replace(/.komodoproject$/, '');
				if (currentProject.importDirectoryLocalPath === null) {
					projectDir = parse.displayPath(currentProject.importDirectoryURI);
				} else {
					projectDir = parse.displayPath(currentProject.importDirectoryLocalPath);
				}
				
				if (displayPath.indexOf(projectDir) !== -1) {
					if (helper.notEmpty(parsedScopes)) {
						for (var i = 0; i < parsedScopes.length; i++) {
							var thisScope = parsedScopes[i];
							if (thisScope.project === currentProjectName) {
								matchedScopes.push(thisScope);
							}
						}
						
						if (matchedScopes.length > 0) {
							
							for (var e = 0; e < matchedScopes.length; e++) {
								var matchScope = matchedScopes[e];
								var outputfiles = matchScope.outputfiles;
								var includeFolders = matchScope.includeFolders;
								var matchedOutputFile = false;
								
								if (outputfiles.length > 1) {
									
									for (var s = 0; s < outputfiles.length; s++) {
										var matchString = outputfiles[s];
										if (displayPath.indexOf(matchString) !== -1) {
											path = displayPath;
											matchedOutputFile = true;
										}
									}
									
									if (includeFolders.length > 0) {
										for (var m = 0; m < includeFolders.length; m++) {
											var matchString = includeFolders[m];
											if (displayPath.indexOf(matchString) !== -1) {
												self.compileMultipleFiles(matchScope, getVars);
												return false;
											}
										}
									}
									
								} else if(outputfiles.length === 1) {
									
									if (displayPath.indexOf(outputfiles[0]) !== -1) {
										path = displayPath;
										matchedOutputFile = true;
									}
									
									if (includeFolders.length > 0) {
										for (var n = 0; n < includeFolders.length; n++) {
											var matchString = includeFolders[n];
											if (displayPath.indexOf(matchString) !== -1) {
												path = projectDir + outputfiles[0];
											}
										}
									}
								} 
							}
						} else {
							notify.send('File outside scope', 'Tools');
							path = displayPath;
						}
						
					} else {
						notify.send('File Scopes are empty', 'Tools');
						path = displayPath;
					}
				} else {
					notify.send('File not in current project', 'Tools');
					path = displayPath;
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
			self._notifcation('SASS: Please save the file first', true);
			return;	
		}
		
		if (file.ext == '.sass' || file.ext == '.scss') {
			if (prefs.getBoolPref('useFilewatcher') == false) {
				prefs.setBoolPref('useFilewatcher', true);
			}
			
			prefs.setCharPref('fileWatcher', path);
			self._notifcation('SASS: file watcher enabled');
			self._updateStatusBar();
		} else {
			self._notifcation('SASS: Please select a SASS file', true);
			self._updateStatusBar('SASS: Please select a SASS file');
			return;	
		}
	}
	
	this.disableFileWatcher = function(){
		if (prefs.getBoolPref('useFilewatcher')) {
			prefs.setBoolPref('useFilewatcher', false);
		}
		
		prefs.setCharPref('fileWatcher', '');
		self._notifcation('SASS: file watcher disabled');
		self._updateStatusBar();
	}
	
	this.enableCompiler = function() {
		prefs.setBoolPref('compilerEnabled', true);
		self._notifcation('SASS: Compiler Enabled');
		self._updateStatusBar();
	}

	this.disableCompiler = function() {
		prefs.setBoolPref('compilerEnabled', false);
		self._notifcation('SASS: Compiler disabled');
		self._updateStatusBar();
	}
	
	this.enableFilescopes = function() {
		prefs.setBoolPref('useFileScopes', true);
		self._notifcation('SASS: File scopes Enabled');
		self._updateStatusBar();
	}

	this.disableFileScopes = function() {
		prefs.setBoolPref('useFileScopes', false);
		self._notifcation('SASS: File scopes disabled');
		self._updateStatusBar();
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
					
					var fileName = file.replace(/(@import\s|["';]+)/gi, '');
					
					if (/(.sass|.scss)$/i.test(fileName) == false) {
						fileName = fileName + fileExt;
					}
					
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
			self._notifcation('SASS ERROR: Saving file ' + filepath + ', Message: ' + e, true);
		}

		return;
		
	};
	
	this._readFile = function(root, filepath, prefix = false) {

		var fileName,
			fullUrl = root + filepath,
			fileUrl = self._parse_uri(fullUrl),
			newRoot = '',
			backPatern = /\.\.\/+/;

		//figure out ftp path if ../ in path
		if (filepath.search(backPatern) !== -1) {

			var output = self._parse_backDirectories(fullUrl, filepath, root),
				fileName = output.fileName,
				fileUrl = output.fileUrl;

		} else {
			var fileName = '';
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
				self._notifcation('SASS ERROR: Reading file: ' + fileUrl, true);
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
	
	this._parse_backDirectories = function(fullUrl, filePath, root) {
		var url = self._parse_uri(fullUrl),
			backDirectorys = filePath.match(/\.\.\//g),
			fileName = url.substr(self._last_slash(url) + 1, url.length),
			fileBase = filePath.replace(/\.\.\//g, '');
			base = root;
			
		for (var x = 0; x < backDirectorys.length + 1; x++) {
			base = base.substr(0, self._last_slash(base));
			if (x === backDirectorys.length) {
				base = base + '/';
			}
		}
		
		return {
			fileUrl: base + fileBase,
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
		
		if (prefs.getBoolPref('useFilewatcher') && !prefs.getBoolPref('useFileScopes')) {
			self._notifcation('SASS: File watcher is still enabled form last session or is enabled in a other window.');
		}
	}

	this._checkForSearch = function() {
		if (search) {
			self.getVars(true);
			search = false;
		}
	}
	
	this.addPanel = function(){
		ko.views.manager.currentView.setFocus();
		var view 	= $(require("ko/views").current().get()),
		SASSpanel	= $("<statusbarpanel id='statusbar-sass' />");
		
		if (view === undefined) {
			return;
 		}
		
		if ($('#statusbar-sass').length > 0) {
			$('#statusbar-sass').remove();
		}
		
		view.findAnonymous("anonid", "statusbar-encoding").before(SASSpanel);
 	}

	this._updateView = function() {
		var wrapper = $('#sass_wrapper');
		if (wrapper.length > 0) {
			wrapper.remove();
		}

		self._updateStatusBar();
	}

	this._calculateXpos = function() {
		var currentWindowPos = editor.getCursorWindowPosition(true);
			
		return currentWindowPos.x;
	}

	this._calculateYpos = function() {
		var currentWindowPos = editor.getCursorWindowPosition(true),
			defaultTextHeight = (ko.views.manager.currentView.scimoz.textHeight(0) - 10),
			adjustY =+ prefs.getIntPref('tooltipY');
			
			defaultTextHeight = defaultTextHeight + adjustY;
		
		return (currentWindowPos.y + defaultTextHeight);
	}

	insertSassVar = function() {
		var scimoz = ko.views.manager.currentView.scimoz,
			currentLine =	scimoz.lineFromPosition(scimoz.currentPos),
			input = $('#sass_auto');

		if (input.length > 0) {
			var val = input.value();

			if (val.length > 0) {
				scimoz.insertText(scimoz.currentPos, val);
				scimoz.gotoPos(scimoz.currentPos + val.length);
			}
			input.parent().remove();
			ko.views.manager.currentView.setFocus();
			
			setTimeout(function(){
				if (scimoz.lineFromPosition(scimoz.currentPos) > currentLine) {
					scimoz.homeExtend();
					scimoz.charLeftExtend();
					scimoz.replaceSel('');
				}
				
			}, 50);
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
			mainWindow = document.getElementById('komodo_main'),
			popup = document.getElementById('sass_wrapper'),
			autocomplete = document.createElement('textbox'),
			currentView = ko.views.manager.currentView,
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
			autocomplete.setAttribute('ignoreblurwhilesearching', 'true');
			autocomplete.setAttribute('minresultsforpopup', '0');
			autocomplete.setAttribute('onblur', 'blurSassComletion()');
			autocomplete.setAttribute('onfocus', 'focusSassCompletion()');
			popup.appendChild(autocomplete);

			mainWindow.appendChild(popup);
		}

		if (typeof completions === 'undefined') {
			self._notifcation('No vars set, going find some!');
			self._getVars();
			return false;
		}


		if (completions.length > 0) {
			if (currentView.scintilla.autocomplete.active) {
				currentView.scintilla.autocomplete.close();
			}
			autocomplete.setAttribute('autocompletesearchparam', completions);
			popup.openPopup(mainWindow, "", x, y, false, false);
			autocomplete.focus();
			autocomplete.value = "$";
			autocomplete.open = true;
		}

	}

	this._updateStatusBar = function(message, error) {
		message = message || false;
		error = error || false;
		var label = 'Compiler Enabled',
			compileEnabled = prefs.getBoolPref('compilerEnabled');

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
			self.addPanel();

			if (prefs.getBoolPref('useFileScopes')) {
				var path = 'Outside file scope',
					filePath = (file) ? file.URI : null,
					parser = ko.uriparse;
					
				var parser = ko.uriparse,
					displayPath = parser.displayPath(filePath),
					projectDir;
				var fileScopes = prefs.getCharPref('fileScopes');
				var parsedScopes = JSON.parse(fileScopes);
				var currentProject = ko.projects.manager.currentProject;
				var matchedScopes = [];
				
				if (currentProject === null) {
					path = 'No current project';
				} else {
					var currentProjectName = currentProject.name.replace(/.komodoproject$/, '');
					if (currentProject.importDirectoryLocalPath === null) {
						projectDir = parse.displayPath(currentProject.importDirectoryURI);
					} else {
						projectDir = parse.displayPath(currentProject.importDirectoryLocalPath);
					}
					
					if (displayPath.indexOf(projectDir) !== -1) {
						if (helper.notEmpty(parsedScopes)) {
							for (var i = 0; i < parsedScopes.length; i++) {
								var thisScope = parsedScopes[i];
								if (thisScope.project === currentProjectName) {
									matchedScopes.push(thisScope);
								}
							}
							
							if (matchedScopes.length > 0) {
								
								for (var e = 0; e < matchedScopes.length; e++) {
									var matchScope = matchedScopes[e];
									var outputfiles = matchScope.outputfiles;
									var includeFolders = matchScope.includeFolders;
									var matchedOutputFile = false;
									
									if (outputfiles.length > 1) {
										
										for (var s = 0; s < outputfiles.length; s++) {
											var matchString = outputfiles[s];
											if (displayPath.indexOf(matchString) !== -1) {
												path = matchScope.name;
												matchedOutputFile = true;
											}
										}
										
										if (!matchedOutputFile) {
											for (var m = 0; m < includeFolders.length; m++) {
												var matchString = includeFolders[m];
												if (displayPath.indexOf(matchString) !== -1) {
													path = matchScope.name;
												}
											}
										}
										
									} else if(outputfiles.length === 1) {
										
										if (displayPath.indexOf(outputfiles[0]) !== -1) {
											path = matchScope.name;
											matchedOutputFile = true;
										}
										
										if (!matchedOutputFile) {
											for (var n = 0; n < includeFolders.length; n++) {
												var matchString = includeFolders[n];
												if (displayPath.indexOf(matchString) !== -1) {
													path = matchScope.name;
												}
											}
										}
										
									} 
									
									
								}
							} else {
								path = 'File outside scope';
							}
							
						} else {
							path = 'File Scopes are empty';
						}
					} else {
						path = 'File not in current project';
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
			
			var menu = document.createElement('menupopup'),
				enableDisable = document.createElement('menuitem'),
				fileWatcherItem = document.createElement('menuitem'),
				settingsItem = document.createElement('menuitem'),
				fileScopesEnable = document.createElement('menuitem'),
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
			
			if (prefs.getBoolPref('useFileScopes')) {
				fileScopesEnable.setAttribute('label', 'Disable File Scopes');
				fileScopesEnable.setAttribute('oncommand', 'extensions.sass.disableFileScopes();');
			} else {
				fileScopesEnable.setAttribute('label', 'Enable File Scopes');
				fileScopesEnable.setAttribute('oncommand', 'extensions.sass.enableFilescopes();');
			}

			fileScopes.setAttribute('label', 'File Scopes'),
				fileScopes.setAttribute('oncommand', 'extensions.sass.OpenSassFileScopes();');

			settingsItem.setAttribute('label', 'Settings'),
				settingsItem.setAttribute('oncommand', 'extensions.sass.OpenSassSettings();');

			menu.appendChild(enableDisable);
			menu.appendChild(fileWatcherItem);
			menu.appendChild(fileScopesEnable);
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
			
			if (panel.length === 0){		
				self.addPanel();		
				panel = document.getElementById('statusbar-sass');		
			}

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
			
			var currentView = ko.views.manager.currentView;
			if (!currentView) {
				return;
			}
			
			var language = currentView.language;
			if (!language) {
				return;
			}
			if (language !== 'Sass' && language !== 'SCSS') {
				return;
			}
			
			var scimoz = currentView.scimoz;
			if (e.shiftKey && e.charCode == 36 && !e.altKey && !e.metaKey) {
				var d = currentView.document || currentView.koDoc,
					file = d.file;

				if (!file) {
					self._notifcation('Please save the file first', true);
					return;
				}
				
				if ( !scimoz || ! scimoz.focus) {
					return false;
				}

				if (file.ext == '.sass' || file.ext == '.scss') {
					var currentLine = scimoz.lineFromPosition(scimoz.currentPos),
						currentLineStart = scimoz.lineLength(currentLine);

					try {
						if (currentLineStart > 3) {
							e.preventDefault();
							e.stopPropagation();
							if (scimoz.selText.length > 0) {
								scimoz.replaceSel('');
							}
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
	
	this._notifcation = function($message, error){
		$message =$message || false;
		error = error || false;
		var msgType = prefs.getCharPref('msgType');
		
		if (msgType === 'web-notifications') {
			
			if (!notification) {
				notification = true;
				var icon = error ? 'chrome://sass/content/sass-error-icon.png' : 'chrome://sass/content/sass-icon.png';
				if (!("Notification" in window)) {
					alert("This browser does not support system notifications");
				}
				
				else if (Notification.permission === "granted") {
					var options = {
					body: $message,
					icon: icon
					}
					var n = new Notification('SASS Compiler', options);
					setTimeout(function(){
						n.close.bind(n);
						notification = false;
					}, 5000); 
				}
				
				else if (Notification.permission !== 'denied') {
					Notification.requestPermission(function (permission) {
					if (permission === "granted") {
						var options = {
							 body: $message,
							 icon: icon
						 }
						 var n = new Notification('SASS Compiler', options);
						setTimeout(function(){
							n.close.bind(n);
							notification = false;
						}, 5000); 
					}
					});
				}
			} else {
				setTimeout(function(){
					self._notifcation($message, error);
				}, 200);
			}
			
			
		} else {
			notify.send(
					$message,
					'tools'
			);
		}
	}

	var features = "chrome,titlebar,toolbar,centerscreen,dependent";
	this.OpenSassSettings = function() {
		window.openDialog('chrome://sass/content/pref-overlay.xul', "sassSettings", features);
	}

	this.OpenSassFileScopes = function() {
		var currentProject = ko.projects.manager.currentProject;
		var windowVars = {
			ko: ko,
			sassData: sassData,
			prefs: prefs,
			overlay: self,
			notify: notify,
			project: currentProject,
		};
		
		window.openDialog('chrome://sass/content/fileScopes.xul', "sassFileScopes", features, windowVars);
	}
	
	this.openNewFileScope = function(scope){
		scope = scope || false;
		
		features = features + ',alwaysRaised';
		
		var currentProject = ko.projects.manager.currentProject;
		var windowVars = {
			ko: ko,
			scope: scope,
			sassData: sassData,
			prefs: prefs,
			overlay: self,
			notify: notify,
			project: currentProject,
		};
		
		if (currentProject === null && scope === false) {
			alert('No current project selected');
			window.focus();
			return false;
		}
		
		window.openDialog('chrome://sass/content/new-filescope.xul', "newFileScope", features, windowVars);
	}
	
	this._focusFileScopes = function(){
		setTimeout(function(){
			helper.focusWin('sassFileScopes');
		}, 500);
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






