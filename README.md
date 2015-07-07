# Komodo-sass-compiler
Sass/Scss compiler for komodo edit/ide

a SASS compiler for Komodo Edit/Ide.

<b>not finished</b>

<h2>Usage</h2>
<p>Goto to Tools -&gt; SASS and select an option.</p>
<ul>
<li><strong><em>Compile Saved File into CSS</em></strong><br>
takes a .sass or .scss file and creates a .css file with the same name in the same spot as the .sass or .scss file.</li>
<li><strong><em>Compile Current Buffer</em></strong><br>
into CSS takes the contents of the current buffer and turns it into CSS.</li>
<li><strong><em>Compile Selection into CSS</em></strong><br> 
takes the current selection and turns it into CSS.</li>
<li><strong><em>Compile and Compress Saved File into CSS</em></strong><br>
takes a .sass or .scss file and creates a .css file with the same name in the same spot as the .sass or .scss file. The .sass file will be compressed/minified.</li>
<li><strong><em>Compile and Compress Current Buffer</em></strong><br>
into CSS takes the contents of the current buffer and turns it into compressed CSS.</li>
<li><strong><em>Compile and Compress Selection into CSS</em></strong><br> 
takes the current selection and turns it into compressed CSS.</li>
<li><strong><em>Collect $vars</em></strong><br> 
collect all the SASS $vars for auto completion.</li>
<li><strong>File Watcher</strong><ul>
<li>
<strong>Enable File Watcher for current file</strong><br>
Enables a file watcher for current .scss or .sass file
</li>
<li>
<strong>disable File Watcher</strong><br>
Disables the file watcher
</li>
</ul>
</ul>
<em>When you right-click on the file you get the same option list (SASS > options).</em>


<h2>Macro's</h2>
<p>You can create a macro that will automatically turn a .sass or .scss file into CSS when you save. Use the following code and have it trigger After file save:</p>
```javascript
if (extensions.sass) {
	extensions.sass.compileFile();
}
```
<p>The following macro will compile and compress the current file in tho css.</p>
```javascript
if (extensions.sass) {
	extensions.sass.compileCompressFile();
}
```

<h2>$vars completion</h2>
<p>This extension also includes a $var auto completion for a better SASS integration in Komodo.<br>
This completion box is triggered when you type <code>$</code>.</p>
<p>To set up the auto completion you will have to set 2 marco's the first one is to enable the completion, and the other to get the $vars from your document.<br>
A known <b>bug</b> is that after insertion white space is added, i created a "fix" if you type <code>;</code> or <code>)</code> the white space is removed and if there is a additional <code>;</code> or <code>)</code> it will be removed (for or Emmet users).</p>
<p>The following marco will trigger a custom auto completion box with SASS $vars (trigger after start up).  
</p>

```javascript
if (extensions.sass) {
    extensions.sass.varCompletion();
}
 ```
 <p>The next marco is for getting the $vars form your document (current view or the file where the file watcher is enabled including @imports) (trigger on custom key binding, i use <kbd>Alt</kbd> + <kbd>g</kbd>)<br>
 if you working with SASS and you have not search for $vars and you trigger the completion $.</p>
 ```javascript
 if (extensions.sass) {
    extensions.sass.getVars(); 
}
```