const panels = {
	write: 'write',
	read: 'read',
	perform: 'perform',
}

const notHiddenChildren = ':not(style,script,hypertext-blankline,hypertext-comment)'

export const compile = (script) => {
	const NORMAL_MODE = Symbol('normal')
	const KEY_VALUE_MODE = Symbol('key-value')
	const DYNAMIC_MODE = Symbol('dynamic')

  const HyperText = {
    '#': append.bind({}, 'hypertext-address'),
    '@': append.bind({}, 'hypertext-character'),
    '"': append.bind({}, 'hypertext-quote'),
    '(': append.bind({}, 'hypertext-parenthetical'),
    '!': append.bind({}, 'hypertext-comment'),
    '^': append.bind({}, 'hypertext-effect'),
    '<': plugin,
    '{': scope,
  }

  function scope(type) {
    setScope(type)
    resetAttributes(type)
    setMode(KEY_VALUE_MODE)
  }

  function plugin(x) {
    setPlugin(x)
    resetAttributes(x)
    setMode(DYNAMIC_MODE)
  }

  const symbols = Object.keys(HyperText)

  const modes = {
    [NORMAL_MODE]: normalMode,
    [KEY_VALUE_MODE]: kvMode,
    [DYNAMIC_MODE]: dynamicMode,
  }

  const isolate = {
    scope: 'global',
    plugin: '',
    mode: NORMAL_MODE,
    result: ``
  }

  const lines = script.split('\n')

  for (const line of lines) {
    (modes[isolate.mode] || noop)(line)
  }

  return isolate.result

  function normalMode(line) {
    if(!line) return blank()

    const symbol = line[0]

    if(symbols.includes(symbol)) {
      const [_, text] = line.split(symbol)
      return HyperText[symbol](text.trim())
    }

    return action(line)
  }

  function kvMode(line, separator=':') {
    const index = line.indexOf(separator)
    const key = line.substring(0, index)
    const value = line.substring(index+1)

    if(!value) {
      if(isolate.scope === 'screenplay') {
        title()
      }
      return setMode(NORMAL_MODE)
    }

    state[isolate.scope][key.trim()] = value.trim()
  }

  function dynamicMode(line, separator=':') {
    const index = line.indexOf(separator)
    const key = line.substring(0, index)
    const value = line.substring(index+1)

    if(!value) {
      embed()
      return setMode(NORMAL_MODE)
    }

    state[isolate.plugin][key.trim()] = value.trim()
  }

  function setMode(m) {
    isolate.mode = m
  }

  function setScope(s) {
    isolate.scope = s
  }

  function setPlugin(d) {
    isolate.plugin = d
  }

  function resetAttributes(x) {
    state[x] = {}
  }

  function title() {
    const {
      title,
      author,
      contact,
      agent
    } = state[isolate.scope]

    append('hypertext-title', `
      <title-cover>
        <title-main>
          <title-title>
            ${title}
          </title-title>
          by
          <title-author>
            ${author}
          </title-author>
        </title-main>
        <title-contact>
          ${markup(contact) || '' }
        </title-contact>
        <title-agent>
          ${markup(agent) || '' }
        </title-agent>
      </title-cover>
    `)
  }
  function embed() {
    const properties = state[isolate.plugin]

    const attributes = Object.keys(properties)
      .map(x => `${x}="${properties[x]}"`).join('')

    isolate.result += `<${isolate.plugin} ${attributes}></${isolate.plugin}>`
  }

  function markup(string) {
    return string && string.replaceAll('\\', '<br>')
  }

  function action(line) {
    append('hypertext-action', line)
  }

  function blank() {
    append("hypertext-blankline", "")
  }

  function append(tag, content) {
    const html = `
      <${tag}>
        ${content}
      </${tag}>
    `
    isolate.result += html
  }

  function noop() {}
}

const $ = module('hyper-script', {
  file: 'booting...',
  activePanel: panels.write,
  activeShot: 0,
  shotCount: 0
})

function source(target) {
  return target.closest('[src]').getAttribute('src')
}

function sourceFile(target) {
  const src = source(target)
  return state[src]
    ? state[src]
    : (function initialize() {
      state[src] = {
        file: hello(),
        html: '&hearts;',
        embed: ';)'
      }
      return state[src]
    })()
}

$.when('input', 'textarea', (event) => {
  const src = source(event.target)
  const { value } = event.target
  state[src].file = value
  const html = compile(value)
  state[src].html = html
  state[src].embed = `<iframe src="${window.location.href}&readonly=true" title="embed"></iframe>`
})

$.when('click', '[data-read]', (event) => {
  $.teach({ nextPanel: panels.read })
})

$.when('click', '[data-print]', (event) => {
  const node = event.target.closest($.link)
  const read = node.querySelector('[name="print"] iframe').contentWindow
  read.focus()
  read.print()
})

$.when('click', '[data-perform]', (event) => {
  const { html } = sourceFile(event.target)
	const wrapper= document.createElement('div');
  wrapper.innerHTML = html;
  const shotList = Array.from(wrapper.children)
    .filter(x => x.matches(notHiddenChildren))

  $.teach({
    shotCount: shotList.length - 1,
    activeShot: 0,
    nextPanel: panels.perform
  })
})

$.when('click', '[data-back]', (event) => {
  const { activeShot } = $.learn()
  if(activeShot === 0) return
  $.teach({ activeShot: activeShot - 1, lastAction: 'back' })
})


$.when('change', '[data-shot]', (event) => {
  const { activeShot, shotCount } = $.learn()
  const { value } = event.target
  const nextShot = parseInt(value)
  if(nextShot < 0) {
		$.teach({ activeShot: 0 })
		return
	}

	if(nextShot >= shotCount){ 
		// keep existing
		$.teach({ activeShot: shotCount })
		return
	}
  $.teach({ activeShot: nextShot })
})

$.when('click', '[data-next]', (event) => {
  const { shotCount, activeShot } = $.learn()
  if(activeShot > shotCount) return
  $.teach({ activeShot: activeShot + 1, lastAction: 'next' })
})

function getMotion(html, { active = 0, forwards, start, end }) {
  const wrapper= document.createElement('div');
  wrapper.innerHTML = html;
  const children = Array.from(wrapper.children)
    .filter(x => x.matches(notHiddenChildren))

	if(children[active]) {
		children[active].dataset.active = true
	}
  const slice = children.slice(start, end).map(x => {
    x.setAttribute('name','beat')
    return x
  })
  if(slice.length === 0) return ''

  const options = { width: 1920, height: 1080, forwards }
  return toVfx(slice, options)
}

function toVfx(slice, options) {
  let beats = options.forwards ? slice : reverse(slice.reverse())
  if(beats[0].matches(':not([data-active])')) {
    beats[0].dataset.animateOut = true
  }

  if(beats[beats.length-1].matches(':not([data-active])')) {
    beats[beats.length-1].dataset.animateIn = true
  }

  return (options.forwards ? beats : slice.reverse())
            .map(x => {;return x.outerHTML}).join('')
}

function reverse(beats) {
  return beats.map(x => {x.dataset.reverse = true; return x;})
}

$.when('click', '[data-write]', (event) => {
  $.teach({ nextPanel: panels.write })
})

$.draw(target => {
	const { id } = target
  let { activePanel, nextPanel, shotCount, activeShot, lastAction } = $.learn()
  const { file, html, embed } = sourceFile(target)

  const readonly = target.getAttribute('readonly')
  const presentation = target.getAttribute('presentation')

  if(readonly) {
    return `
			<div name="page">
				${html}
			</div>
		`
  }

  if(presentation) {
    activePanel = panels.perform
  }

  const escapedFile = escapeHyperText(file)

  if(target.lastPanel !== activePanel) {
    // flush outdated
    target.innerHTML = ''
    target.lastPanel = activePanel
  }

  const start = Math.max(activeShot - 1, 0)
  const end = Math.min(activeShot + 2, shotCount)
  const forwards = lastAction !== 'back'
  const motion = getMotion(html, { active: activeShot, forwards, start, end })

	const views = {
		[panels.write]: () => `
			<div name="write">
        <textarea>${escapedFile}</textarea>
      </div>
		`,
		[panels.read]: () => `
			<div name="read">
				<div name="page">
					${html}
				</div>
				<div name="navi">
					<button data-print>Print</button>
					<div name="print">
						${embed}
					</div>
				</div>
      </div>
    `,
		[panels.perform]: () => `
			<div name="perform">
        <div name="theater">
          <div name="screen">
            <div name="stage">
              ${motion}
            </div>
          </div>
        </div>
				<div name="navi"
					${activeShot === 0 ? 'data-first' : ''}
					${activeShot === shotCount ? 'data-last' : ''}
				>
					<button data-back>
						Back
					</button>
					<input data-shot type="number" min="0" max="${shotCount}" value="${activeShot}"/>
					<button data-next>
						Next
					</button>
				</div>
      </div>
    `,
		'default': () => `
			Nothing for ya. Head back to camp.
    `
	}

	const view = (views[activePanel] || views['default'])()
	const fadeOut = nextPanel && activePanel !== nextPanel

	const perspective = `
		<div class="grid" data-panel="${activePanel}">
      <div name="transport">
        <div name="actions">
          <button data-write>Write</button>
          <button data-read>Read</button>
          <button data-perform>Perform</button>
        </div>
      </div>
			<transition class="${fadeOut ? 'out' : ''}" data-id="${id}">
				${view}
			</transition>
		</div>
	`

  if(activePanel === panels.perform) {
    target.innerHTML = perspective
    return
  }

  return perspective
})

$.when('animationend', 'transition', function transition({target}) {
  const { activePanel, nextPanel, backPanel } = $.learn()
	const current = nextPanel ? nextPanel : activePanel
	const previous = activePanel !== backPanel ? backPanel : activePanel
	$.teach({ activePanel: current, backPanel: previous })
	target.scrollTop = '0'
	document.activeElement.blur()
})

$.style(`
	@media print {
		html, body {
			height: 100%;
			padding: 0;
		}
	}


	@page {
		size: 8.5in 11in;
		margin: 1in 1in 1in 1.5in;
	}

	@page {
		@top-right {
			content: counter(page) '.';
		}
	}

	@page:first {
		@top-right {
			content: '';
		}
	}

  & {
    overflow: auto;
  }
  & .grid {
    display: grid;
    grid-template-rows: 1fr;
    height: 100vh;
  }

  & [name="transport"] {
    overflow-x: auto;
    max-width: 100%;
    position: absolute;
    bottom: 0;
    right: 0;
    z-index: 2;
    display: inline-flex;
    justify-content: end;
  }

  & button {
    background: rgba(0,0,0,.85);
    border-radius: 0;
    border: none;
    color: dodgerblue;
    cursor: pointer;
    height: 2rem;
    border-radius: 1rem;
    transition: color 100ms;
    padding: .25rem 1rem;
  }

  & button:hover,
  & button:focus {
    color: white;
  }

  & [name="actions"] {
    display: inline-flex;
    justify-content: end;
    background: rgba(0,0,0,.15);
    border: 1px solid rgba(255,255,255,.15);
    gap: .25rem;
    border-radius: 1.5rem;
    padding: .5rem;
  }

  & [name="read"] > *${notHiddenChildren} {
    display: block;
  }

  & [name="navi"] {
    position: fixed;
    right: 3rem;
    top: 0;
    height: 2rem;
    display: flex;
    gap: .5rem;
    z-index: 1;
  }

  & [name="theater"] {
    width: 100%;
    height: 100%;
    background: black;
  }

  & [name="screen"] {
    position:relative;
    overflow: hidden;
    background: white;
    aspect-ratio: 16/9;
    transform: translateY(-50%);
    top: 50%;
    max-height: calc(100vh - 6rem);
    margin: auto;
  }

  & [name="stage"] {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    align-items: center;
    justify-content: center;
    grid-template-areas: 'stage';
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 1rem;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    place-content: center;
    background: #54796d;
  }

  & [name="stage"] > * {
    display: block;
    grid-area: stage;
    opacity: 0;
    transition: opacity 100ms;
    border-radius: 1rem;
    padding: 1rem;
    margin: 0;
    background: white;
  }


  & [name="stage"] > *[data-active] {
    opacity: 1;
    z-index: 2;
  }

  & [name="read"],
  & [name="print"],
  & [name="perform"],
  & [name="write"] {
    display: none;
  }

  & [data-panel="read"] [name="read"],
  & [data-panel="perform"] [name="perform"],
  & [data-panel="write"] [name="write"] {
    display: block;
  }

  & [data-panel="read"] [data-read],
  & [data-panel="perform"] [data-perform],
  & [data-panel="write"] [data-write] {
    background: dodgerblue;
    color: black;
    cursor: default;
  }

  & [name="read"] {
    background: white;
		margin: 0 auto;
    padding: 0 1in;
    max-width: 8.5in;
    overflow: auto;
	}
  & [name="page"] {
		font-size: 12pt;
		font-family: courier;
    height: 100%;
    max-height: 100vh;
  }
  & [name="perform"] {
    background: black;
  }
  & [name="print"] {
    display: none;
  }

  & iframe {
    display: block;
    border: none;
    width: 100%;
    height: 100%;
  }

	& input[type="number"]::-webkit-outer-spin-button,
	& input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
	}

	& input[type="number"] {
		-moz-appearance: textfield;
	}

  & textarea {
    width: 100%;
    height: 100%;
    z-index: 1;
    position: relative;
    border: none;
    display: block;
    resize: none;
    padding: .5rem;
  }

  & [data-shot] {
    width: 6ch;
    border: none;
    background: rgba(33,33,33,.85);
    color: white;
    text-align: center;
    border-radius: 1rem;
    padding: 0 .5rem;
  }

  & [data-first] [data-back],
  & [data-last] [data-next] {
    pointer-events: none;
    opacity: .5;
  }


  & [name="beat"] {
    --size-small: scale(.9);
    --size-normal: scale(1);
    --offset-direction: translate(0, -1rem);
    --offset-none: translate(0, 0);
    transform:
        var(--size-normal)
        var(--offset-none);
    transition: all 250ms ease-in-out;
  }

  & [data-animate-in] {
    animation: animate 500ms ease-in-out forwards;
    background: rgba(255,255,255,.15);
    color: rgba(0,0,0,.15);
  }

  & [data-animate-out] {
    --offset-direction: var(--offset-left);
    animation: animate 500ms ease-in-out reverse;
    background: rgba(0,0,0,.85);
    color: rgba(255,255,255,.85);
  }

  & [data-animate-in][data-reverse] {
    --offset-direction: var(--offset-left);
    animation: animate 500ms ease-in-out forwards;
    background: rgba(255,255,255,.15);
    color: rgba(0,0,0,.15);
  }

  & [data-animate-out][data-reverse] {
    --offset-direction: var(--offset-right);
    animation: animate 500ms ease-in-out reverse;
    background: rgba(0,0,0,.85);
    color: rgba(255,255,255,.85);
  }

  @keyframes animate {
    0% {
      transform:
        var(--size-small)
        var(--offset-direction);
      opacity: 0;
      filter: blur(3px);
    }

    33% {
      transform:
        var(--size-small)
        var(--offset-direction);
    }

    66% {
      transform:
        var(--size-small)
        var(--offset-none);
    }

    100% {
      transform:
        var(--size-normal)
        var(--offset-none);
      opacity: 1;
      pointer-events: initial;
      filter: blur(0);
    }
  }

  @media print {
    & {
      width: auto;
      height: auto;
      overflow: visible;
    }
    & [name="read"] {
      display: block;
    }

    & [name="transport"],
    & textarea {
      display: none;
    }
    & .grid {
      display: block;
      height: auto;
      overflow: auto;
    }
  }

	& transition {
		animation: &-fade-in ease-in-out 1ms;
		display: grid;
		height: 100%;
		place-items: center;
		width: 100%;
	}


	& transition > * {
		width: 100%;
		height: 100%;
	}

	& transition.out {
		animation: &-fade-out ease-in-out 1ms;
	}

	@keyframes &-fade-in {
		0% {
		}
		100% {
		}
	}

	@keyframes &-fade-out {
		0% {
		}
		100% {
		}
	}



	& title-cover {
		display: grid;
		grid-template-areas:
			"main main"
			"contact agent";
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr auto;
		width: 100%;
		height: 100%;
	}

	& title-main {
		place-self: center;
		grid-area: main;
		text-align: center;
	}

	& title-title {
		margin-bottom: 1rem;
	}

	& title-title,
	& title-author {
		display: block;
	}

	& title-contact {
		grid-area: contact;
	}

	& title-agent {
		grid-area: agent;
	}

	&	hypertext-title {
			display: block;
			height: 100%;
			width: 100%;
		}

	&	hypertext-blankline {
			display: block;
		}
`)

function hello() {
  return `{ screenplay
title: Sillonious
author: Ty

! This feels like a fuzzy dream sequence with everything over exposed except the colors red, blue, and green.

^ fade in

# Int. Computer
In the computer. Like Zoolander. Like Owen Wilson's character's understanding of in the computer. Ty wears three shirts and three hats. Left wears a blue shirt and hat. Right wears a red shirt and hat. Front wears a green shirt and hat.

@ Ty
" Welcome.

@ Left
" See. I said it could.

@ Right
" It wasn't easy.

@ Front
" Whatever, I can sell it.

<hyper-link
src: /home
label: ok

aww

<greet-friend
x: Victoria
y: es_ES

ok

<hello-world

<hello-nickname

<hello-universe

<hypertext-variable
text: hello world
weight: 800
size: 2rem
height: 6

<rainbow-action
text: sup
prefix: <button>
suffix: </button>

<hypertext-highlighter
text: this is yellow
color: yellow

<sillyz-gamepad

<sillyz-guitar

<sillyz-synth

<sillyz-piano

# the end.
`
}

function escapeHyperText(text) {
  return text.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  )
}
