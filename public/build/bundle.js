
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/components/Layout/Header.svelte generated by Svelte v3.23.1 */

    const file = "src/components/Layout/Header.svelte";

    function create_fragment(ctx) {
    	let t;
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			t = space();
    			div = element("div");
    			img = element("img");
    			document.title = "DevIt";
    			if (img.src !== (img_src_value = "HackathonLogo.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "logo");
    			attr_dev(img, "width", "270px");
    			add_location(img, file, 6, 4, 96);
    			set_style(div, "text-align", "center");
    			add_location(div, file, 5, 0, 56);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Header", $$slots, []);
    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/components/Layout/Footer.svelte generated by Svelte v3.23.1 */

    const file$1 = "src/components/Layout/Footer.svelte";

    function create_fragment$1(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "contect as";
    			set_style(h2, "text-align", "center");
    			add_location(h2, file$1, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Footer", $$slots, []);
    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/components/TODOLISTComponents/Task.svelte generated by Svelte v3.23.1 */
    const file$2 = "src/components/TODOLISTComponents/Task.svelte";

    function create_fragment$2(ctx) {
    	let div4;
    	let div3;
    	let div0;
    	let form;
    	let label;
    	let input;
    	let t0;
    	let span;
    	let t1;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let a;
    	let i;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			form = element("form");
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = text(/*title*/ ctx[1]);
    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			div2 = element("div");
    			a = element("a");
    			i = element("i");
    			i.textContent = "close";
    			attr_dev(input, "type", "checkbox");
    			add_location(input, file$2, 24, 10, 567);
    			attr_dev(span, "class", "svelte-15noo7f");
    			toggle_class(span, "done", /*completed*/ ctx[0]);
    			add_location(span, file$2, 25, 10, 626);
    			set_style(label, "display", "inline-block");
    			add_location(label, file$2, 23, 8, 516);
    			attr_dev(form, "action", "#");
    			attr_dev(form, "class", "inline");
    			add_location(form, file$2, 22, 6, 475);
    			attr_dev(div0, "class", "col l7 m7 s7");
    			add_location(div0, file$2, 21, 4, 442);
    			attr_dev(div1, "class", "col 2");
    			add_location(div1, file$2, 29, 4, 719);
    			attr_dev(i, "class", "material-icons red-text");
    			add_location(i, file$2, 31, 43, 821);
    			attr_dev(a, "href", "#!");
    			add_location(a, file$2, 31, 6, 784);
    			attr_dev(div2, "class", "col l3 m3 s3");
    			add_location(div2, file$2, 30, 4, 751);
    			attr_dev(div3, "class", "row ");
    			add_location(div3, file$2, 20, 2, 419);
    			attr_dev(div4, "class", "container");
    			add_location(div4, file$2, 19, 0, 391);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div0);
    			append_dev(div0, form);
    			append_dev(form, label);
    			append_dev(label, input);
    			input.checked = /*completed*/ ctx[0];
    			append_dev(label, t0);
    			append_dev(label, span);
    			append_dev(span, t1);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, a);
    			append_dev(a, i);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_handler*/ ctx[4]),
    					listen_dev(a, "click", /*handleDelete*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*completed*/ 1) {
    				input.checked = /*completed*/ ctx[0];
    			}

    			if (dirty & /*title*/ 2) set_data_dev(t1, /*title*/ ctx[1]);

    			if (dirty & /*completed*/ 1) {
    				toggle_class(span, "done", /*completed*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { title } = $$props;
    	let { completed } = $$props;
    	let { id } = $$props;

    	const paint = () => {
    		if (completed == true) {
    			return "green-text lighten-2";
    		}

    		return "";
    	};

    	const handleDelete = () => {
    		dispatch("delete", { id });
    	};

    	const writable_props = ["title", "completed", "id"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Task> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Task", $$slots, []);

    	function input_change_handler() {
    		completed = this.checked;
    		$$invalidate(0, completed);
    	}

    	$$self.$set = $$props => {
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("completed" in $$props) $$invalidate(0, completed = $$props.completed);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		title,
    		completed,
    		id,
    		paint,
    		handleDelete
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("completed" in $$props) $$invalidate(0, completed = $$props.completed);
    		if ("id" in $$props) $$invalidate(3, id = $$props.id);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [completed, title, handleDelete, id, input_change_handler];
    }

    class Task extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { title: 1, completed: 0, id: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Task",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[1] === undefined && !("title" in props)) {
    			console.warn("<Task> was created without expected prop 'title'");
    		}

    		if (/*completed*/ ctx[0] === undefined && !("completed" in props)) {
    			console.warn("<Task> was created without expected prop 'completed'");
    		}

    		if (/*id*/ ctx[3] === undefined && !("id" in props)) {
    			console.warn("<Task> was created without expected prop 'id'");
    		}
    	}

    	get title() {
    		throw new Error("<Task>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Task>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get completed() {
    		throw new Error("<Task>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set completed(value) {
    		throw new Error("<Task>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Task>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Task>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var bind = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    /*global toString:true*/

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return toString.call(val) === '[object Array]';
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return (typeof FormData !== 'undefined') && (val instanceof FormData);
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }

    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
    }

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (typeof result[key] === 'object' && typeof val === 'object') {
          result[key] = merge(result[key], val);
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Function equal to merge with the difference being that no reference
     * to original objects is kept.
     *
     * @see merge
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function deepMerge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (typeof result[key] === 'object' && typeof val === 'object') {
          result[key] = deepMerge(result[key], val);
        } else if (typeof val === 'object') {
          result[key] = deepMerge({}, val);
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    var utils = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      deepMerge: deepMerge,
      extend: extend,
      trim: trim
    };

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%40/gi, '@').
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    function InterceptorManager() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData = function transformData(data, headers, fns) {
      /*eslint no-param-reassign:0*/
      utils.forEach(fns, function transform(fn) {
        data = fn(data, headers);
      });

      return data;
    };

    var isCancel = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };

    var normalizeHeaderName = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    var enhanceError = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }

      error.request = request;
      error.response = response;
      error.isAxiosError = true;

      error.toJSON = function() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code
        };
      };
      return error;
    };

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    var createError = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };

    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    var settle = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError(
          'Request failed with status code ' + response.status,
          response.config,
          null,
          response.request,
          response
        ));
      }
    };

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];

    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    var parseHeaders = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;

      if (!headers) { return parsed; }

      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });

      return parsed;
    };

    var isURLSameOrigin = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;

          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;

            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }

            urlParsingNode.setAttribute('href', href);

            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }

          originURL = resolveURL(window.location.href);

          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :

      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );

    var cookies = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));

              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }

              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }

              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }

              if (secure === true) {
                cookie.push('secure');
              }

              document.cookie = cookie.join('; ');
            },

            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },

            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :

      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );

    var xhr = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;

        if (utils.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }

        var request = new XMLHttpRequest();

        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password || '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }

        var fullPath = buildFullPath(config.baseURL, config.url);
        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

        // Set the request timeout in MS
        request.timeout = config.timeout;

        // Listen for ready state
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }

          // The request errored out and we didn't get a response, this will be
          // handled by onerror instead
          // With one exception: request that using file: protocol, most browsers
          // will return status as 0 even though it's a successful request
          if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
            return;
          }

          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };

          settle(resolve, reject, response);

          // Clean up request
          request = null;
        };

        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(createError('Request aborted', config, 'ECONNABORTED', request));

          // Clean up request
          request = null;
        };

        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(createError('Network Error', config, null, request));

          // Clean up request
          request = null;
        };

        // Handle timeout
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
            request));

          // Clean up request
          request = null;
        };

        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils.isStandardBrowserEnv()) {
          var cookies$1 = cookies;

          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies$1.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }

        // Add responseType to request if needed
        if (config.responseType) {
          try {
            request.responseType = config.responseType;
          } catch (e) {
            // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
            // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
            if (config.responseType !== 'json') {
              throw e;
            }
          }
        }

        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken) {
          // Handle cancellation
          config.cancelToken.promise.then(function onCanceled(cancel) {
            if (!request) {
              return;
            }

            request.abort();
            reject(cancel);
            // Clean up request
            request = null;
          });
        }

        if (requestData === undefined) {
          requestData = null;
        }

        // Send the request
        request.send(requestData);
      });
    };

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = xhr;
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = xhr;
      }
      return adapter;
    }

    var defaults = {
      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');
        if (utils.isFormData(data) ||
          utils.isArrayBuffer(data) ||
          utils.isBuffer(data) ||
          utils.isStream(data) ||
          utils.isFile(data) ||
          utils.isBlob(data)
        ) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils.isObject(data)) {
          setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
          return JSON.stringify(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        /*eslint no-param-reassign:0*/
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) { /* Ignore */ }
        }
        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      }
    };

    defaults.headers = {
      common: {
        'Accept': 'application/json, text/plain, */*'
      }
    };

    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults;

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData(
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults_1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData(
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData(
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      var valueFromConfig2Keys = ['url', 'method', 'params', 'data'];
      var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy'];
      var defaultToConfig2Keys = [
        'baseURL', 'url', 'transformRequest', 'transformResponse', 'paramsSerializer',
        'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
        'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress',
        'maxContentLength', 'validateStatus', 'maxRedirects', 'httpAgent',
        'httpsAgent', 'cancelToken', 'socketPath'
      ];

      utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        }
      });

      utils.forEach(mergeDeepPropertiesKeys, function mergeDeepProperties(prop) {
        if (utils.isObject(config2[prop])) {
          config[prop] = utils.deepMerge(config1[prop], config2[prop]);
        } else if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        } else if (utils.isObject(config1[prop])) {
          config[prop] = utils.deepMerge(config1[prop]);
        } else if (typeof config1[prop] !== 'undefined') {
          config[prop] = config1[prop];
        }
      });

      utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        } else if (typeof config1[prop] !== 'undefined') {
          config[prop] = config1[prop];
        }
      });

      var axiosKeys = valueFromConfig2Keys
        .concat(mergeDeepPropertiesKeys)
        .concat(defaultToConfig2Keys);

      var otherKeys = Object
        .keys(config2)
        .filter(function filterAxiosKeys(key) {
          return axiosKeys.indexOf(key) === -1;
        });

      utils.forEach(otherKeys, function otherKeysDefaultToConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') {
          config[prop] = config2[prop];
        } else if (typeof config1[prop] !== 'undefined') {
          config[prop] = config1[prop];
        }
      });

      return config;
    };

    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager_1(),
        response: new InterceptorManager_1()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios.prototype.request = function request(config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof config === 'string') {
        config = arguments[1] || {};
        config.url = arguments[0];
      } else {
        config = config || {};
      }

      config = mergeConfig(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      // Hook up interceptors middleware
      var chain = [dispatchRequest, undefined];
      var promise = Promise.resolve(config);

      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        chain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        chain.push(interceptor.fulfilled, interceptor.rejected);
      });

      while (chain.length) {
        promise = promise.then(chain.shift(), chain.shift());
      }

      return promise;
    };

    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // Provide aliases for supported request methods
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, config) {
        return this.request(utils.merge(config || {}, {
          method: method,
          url: url
        }));
      };
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, data, config) {
        return this.request(utils.merge(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });

    var Axios_1 = Axios;

    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel(message) {
      this.message = message;
    }

    Cancel.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };

    Cancel.prototype.__CANCEL__ = true;

    var Cancel_1 = Cancel;

    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this;
      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }

        token.reason = new Cancel_1(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };

    var CancelToken_1 = CancelToken;

    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    var spread = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios_1(defaultConfig);
      var instance = bind(Axios_1.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios_1.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      return instance;
    }

    // Create the default instance to be exported
    var axios = createInstance(defaults_1);

    // Expose Axios class to allow class inheritance
    axios.Axios = Axios_1;

    // Factory for creating new instances
    axios.create = function create(instanceConfig) {
      return createInstance(mergeConfig(axios.defaults, instanceConfig));
    };

    // Expose Cancel & CancelToken
    axios.Cancel = Cancel_1;
    axios.CancelToken = CancelToken_1;
    axios.isCancel = isCancel;

    // Expose all/spread
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = spread;

    var axios_1 = axios;

    // Allow use of default import syntax in TypeScript
    var _default = axios;
    axios_1.default = _default;

    var axios$1 = axios_1;

    /* src/components/TODOLISTComponents/TODO_Lst.svelte generated by Svelte v3.23.1 */
    const file$3 = "src/components/TODOLISTComponents/TODO_Lst.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (30:10) {#each todo_arr as task, i (i)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let current;
    	const task_spread_levels = [/*task*/ ctx[5]];
    	let task_props = {};

    	for (let i = 0; i < task_spread_levels.length; i += 1) {
    		task_props = assign(task_props, task_spread_levels[i]);
    	}

    	const task = new Task({ props: task_props, $$inline: true });
    	task.$on("delete", /*handleDelete*/ ctx[2]);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(task.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(task, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const task_changes = (dirty & /*todo_arr*/ 2)
    			? get_spread_update(task_spread_levels, [get_spread_object(/*task*/ ctx[5])])
    			: {};

    			task.$set(task_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(task.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(task.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(task, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(30:10) {#each todo_arr as task, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div5;
    	let div4;
    	let div3;
    	let span;
    	let t1;
    	let div0;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t2;
    	let div2;
    	let form;
    	let div1;
    	let input0;
    	let t3;
    	let label;
    	let t5;
    	let input1;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*todo_arr*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[7];
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			span = element("span");
    			span.textContent = "task list";
    			t1 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			div2 = element("div");
    			form = element("form");
    			div1 = element("div");
    			input0 = element("input");
    			t3 = space();
    			label = element("label");
    			label.textContent = "Task";
    			t5 = space();
    			input1 = element("input");
    			attr_dev(span, "class", "card-title");
    			add_location(span, file$3, 27, 8, 584);
    			attr_dev(div0, "class", "card-content");
    			set_style(div0, "height", "40vh");
    			set_style(div0, "overflow", "auto");
    			add_location(div0, file$3, 28, 8, 634);
    			attr_dev(input0, "id", "add-task");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "validate");
    			add_location(input0, file$3, 37, 12, 971);
    			attr_dev(label, "for", "add-task");
    			add_location(label, file$3, 38, 12, 1059);
    			attr_dev(div1, "class", "input-field inline s12 m5");
    			add_location(div1, file$3, 36, 10, 919);
    			attr_dev(input1, "type", "submit");
    			attr_dev(input1, "class", "material-icons green-text");
    			set_style(input1, "background-color", "white");
    			set_style(input1, "border", "none");
    			input1.value = "add";
    			add_location(input1, file$3, 40, 10, 1121);
    			add_location(form, file$3, 35, 8, 875);
    			attr_dev(div2, "class", "card-action");
    			add_location(div2, file$3, 34, 8, 841);
    			attr_dev(div3, "class", "card");
    			add_location(div3, file$3, 26, 6, 557);
    			attr_dev(div4, "class", "row");
    			add_location(div4, file$3, 25, 2, 533);
    			attr_dev(div5, "class", "container");
    			add_location(div5, file$3, 24, 0, 504);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, span);
    			append_dev(div3, t1);
    			append_dev(div3, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, form);
    			append_dev(form, div1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*taskTitle*/ ctx[0]);
    			append_dev(div1, t3);
    			append_dev(div1, label);
    			append_dev(form, t5);
    			append_dev(form, input1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(form, "submit", /*handleAddition*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*todo_arr, handleDelete*/ 6) {
    				const each_value = /*todo_arr*/ ctx[1];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div0, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
    			}

    			if (dirty & /*taskTitle*/ 1 && input0.value !== /*taskTitle*/ ctx[0]) {
    				set_input_value(input0, /*taskTitle*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let taskTitle = "";
    	let todo_arr = [];

    	const handleDelete = e => {
    		$$invalidate(1, todo_arr = todo_arr.filter(todo => todo.id !== e.detail.id));
    	};

    	const handleAddition = () => {
    		$$invalidate(1, todo_arr = [
    			...todo_arr,
    			{
    				title: taskTitle,
    				completed: false,
    				id: todo_arr.length + 1
    			}
    		]);

    		$$invalidate(0, taskTitle = "");
    	};

    	axios$1.get("https://jsonplaceholder.typicode.com/todos?_limit=10").then(res => {
    		$$invalidate(1, todo_arr = res.data);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TODO_Lst> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("TODO_Lst", $$slots, []);

    	function input0_input_handler() {
    		taskTitle = this.value;
    		$$invalidate(0, taskTitle);
    	}

    	$$self.$capture_state = () => ({
    		Task,
    		axios: axios$1,
    		taskTitle,
    		todo_arr,
    		handleDelete,
    		handleAddition
    	});

    	$$self.$inject_state = $$props => {
    		if ("taskTitle" in $$props) $$invalidate(0, taskTitle = $$props.taskTitle);
    		if ("todo_arr" in $$props) $$invalidate(1, todo_arr = $$props.todo_arr);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [taskTitle, todo_arr, handleDelete, handleAddition, input0_input_handler];
    }

    class TODO_Lst extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TODO_Lst",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/components/scheduleComponents/scheduledEvent.svelte generated by Svelte v3.23.1 */
    const file$4 = "src/components/scheduleComponents/scheduledEvent.svelte";

    function create_fragment$4(ctx) {
    	let div2;
    	let div0;
    	let p;
    	let b;
    	let t0_value = /*scheduledEvent*/ ctx[0].event + "";
    	let t0;
    	let t1;
    	let t2_value = /*scheduledEvent*/ ctx[0].date + "";
    	let t2;
    	let t3;
    	let t4_value = /*scheduledEvent*/ ctx[0].time + "";
    	let t4;
    	let t5;
    	let div1;
    	let a;
    	let i;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			p = element("p");
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = text(" in ");
    			t2 = text(t2_value);
    			t3 = text(", ");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			a = element("a");
    			i = element("i");
    			i.textContent = "close";
    			add_location(b, file$4, 14, 6, 290);
    			add_location(p, file$4, 13, 4, 280);
    			attr_dev(div0, "class", "col s12 m9");
    			add_location(div0, file$4, 12, 2, 251);
    			attr_dev(i, "class", "material-icons red-text");
    			add_location(i, file$4, 19, 6, 460);
    			attr_dev(a, "href", "#!");
    			add_location(a, file$4, 18, 4, 416);
    			attr_dev(div1, "class", "col 12 m1");
    			add_location(div1, file$4, 17, 2, 388);
    			attr_dev(div2, "class", "row inline");
    			add_location(div2, file$4, 11, 0, 224);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, p);
    			append_dev(p, b);
    			append_dev(b, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    			append_dev(p, t3);
    			append_dev(p, t4);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, a);
    			append_dev(a, i);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*handleDelete*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*scheduledEvent*/ 1 && t0_value !== (t0_value = /*scheduledEvent*/ ctx[0].event + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*scheduledEvent*/ 1 && t2_value !== (t2_value = /*scheduledEvent*/ ctx[0].date + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*scheduledEvent*/ 1 && t4_value !== (t4_value = /*scheduledEvent*/ ctx[0].time + "")) set_data_dev(t4, t4_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { scheduledEvent } = $$props;

    	const handleDelete = () => {
    		dispatch("delete", scheduledEvent);
    	};

    	const writable_props = ["scheduledEvent"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ScheduledEvent> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ScheduledEvent", $$slots, []);

    	$$self.$set = $$props => {
    		if ("scheduledEvent" in $$props) $$invalidate(0, scheduledEvent = $$props.scheduledEvent);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		scheduledEvent,
    		handleDelete
    	});

    	$$self.$inject_state = $$props => {
    		if ("scheduledEvent" in $$props) $$invalidate(0, scheduledEvent = $$props.scheduledEvent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [scheduledEvent, handleDelete];
    }

    class ScheduledEvent extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { scheduledEvent: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScheduledEvent",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*scheduledEvent*/ ctx[0] === undefined && !("scheduledEvent" in props)) {
    			console.warn("<ScheduledEvent> was created without expected prop 'scheduledEvent'");
    		}
    	}

    	get scheduledEvent() {
    		throw new Error("<ScheduledEvent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scheduledEvent(value) {
    		throw new Error("<ScheduledEvent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/scheduleComponents/Schedule.svelte generated by Svelte v3.23.1 */

    const { console: console_1 } = globals;
    const file$5 = "src/components/scheduleComponents/Schedule.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (53:8) {#each events_list as event, i (i)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let current;

    	const schedevent = new ScheduledEvent({
    			props: { scheduledEvent: /*event*/ ctx[3] },
    			$$inline: true
    		});

    	schedevent.$on("delete", /*handleDelete*/ ctx[5]);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(schedevent.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(schedevent, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const schedevent_changes = {};
    			if (dirty & /*events_list*/ 1) schedevent_changes.scheduledEvent = /*event*/ ctx[3];
    			schedevent.$set(schedevent_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(schedevent.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(schedevent.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(schedevent, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(53:8) {#each events_list as event, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div6;
    	let div5;
    	let span;
    	let t1;
    	let div0;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t2;
    	let div4;
    	let div1;
    	let input0;
    	let t3;
    	let label0;
    	let t5;
    	let div2;
    	let input1;
    	let t6;
    	let label1;
    	let t8;
    	let div3;
    	let input2;
    	let t9;
    	let label2;
    	let t11;
    	let a;
    	let i;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*events_list*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[13];
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			span = element("span");
    			span.textContent = "SCHEDULE";
    			t1 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			div4 = element("div");
    			div1 = element("div");
    			input0 = element("input");
    			t3 = space();
    			label0 = element("label");
    			label0.textContent = "Event";
    			t5 = space();
    			div2 = element("div");
    			input1 = element("input");
    			t6 = space();
    			label1 = element("label");
    			label1.textContent = "Date";
    			t8 = space();
    			div3 = element("div");
    			input2 = element("input");
    			t9 = space();
    			label2 = element("label");
    			label2.textContent = "Time";
    			t11 = space();
    			a = element("a");
    			i = element("i");
    			i.textContent = "add";
    			attr_dev(span, "class", "card-title");
    			add_location(span, file$5, 50, 6, 1265);
    			attr_dev(div0, "class", "card-content");
    			set_style(div0, "height", "20vh");
    			set_style(div0, "overflow", "auto");
    			add_location(div0, file$5, 51, 6, 1312);
    			attr_dev(input0, "id", "add-event");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "validate");
    			add_location(input0, file$5, 60, 10, 1630);
    			attr_dev(label0, "for", "add-event");
    			add_location(label0, file$5, 61, 10, 1712);
    			attr_dev(div1, "class", "input-field inline s12 m3");
    			add_location(div1, file$5, 59, 8, 1580);
    			attr_dev(input1, "id", "add-date");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "datepicker");
    			add_location(input1, file$5, 65, 10, 1823);
    			attr_dev(label1, "for", "add-date");
    			add_location(label1, file$5, 66, 10, 1905);
    			attr_dev(div2, "class", "input-field inline s12 m3");
    			add_location(div2, file$5, 64, 8, 1773);
    			attr_dev(input2, "id", "add-time");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "class", "timepicker");
    			add_location(input2, file$5, 70, 10, 2014);
    			attr_dev(label2, "for", "add-time");
    			add_location(label2, file$5, 71, 10, 2096);
    			attr_dev(div3, "class", "input-field inline s12 m3");
    			add_location(div3, file$5, 69, 8, 1964);
    			attr_dev(i, "class", "material-icons green-text");
    			add_location(i, file$5, 75, 10, 2205);
    			attr_dev(a, "href", "#!");
    			add_location(a, file$5, 74, 8, 2155);
    			attr_dev(div4, "class", "card-action");
    			add_location(div4, file$5, 57, 6, 1545);
    			attr_dev(div5, "class", "card");
    			add_location(div5, file$5, 49, 4, 1240);
    			attr_dev(div6, "class", "row");
    			add_location(div6, file$5, 48, 0, 1218);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, span);
    			append_dev(div5, t1);
    			append_dev(div5, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div5, t2);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*event*/ ctx[3]);
    			append_dev(div1, t3);
    			append_dev(div1, label0);
    			append_dev(div4, t5);
    			append_dev(div4, div2);
    			append_dev(div2, input1);
    			set_input_value(input1, /*date*/ ctx[1]);
    			append_dev(div2, t6);
    			append_dev(div2, label1);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			append_dev(div3, input2);
    			set_input_value(input2, /*time*/ ctx[2]);
    			append_dev(div3, t9);
    			append_dev(div3, label2);
    			append_dev(div4, t11);
    			append_dev(div4, a);
    			append_dev(a, i);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[8]),
    					listen_dev(a, "click", /*handleAddition*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*events_list, handleDelete*/ 33) {
    				const each_value = /*events_list*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div0, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
    				check_outros();
    			}

    			if (dirty & /*event*/ 8 && input0.value !== /*event*/ ctx[3]) {
    				set_input_value(input0, /*event*/ ctx[3]);
    			}

    			if (dirty & /*date*/ 2 && input1.value !== /*date*/ ctx[1]) {
    				set_input_value(input1, /*date*/ ctx[1]);
    			}

    			if (dirty & /*time*/ 4 && input2.value !== /*time*/ ctx[2]) {
    				set_input_value(input2, /*time*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let events_list = [
    		{
    			event: "bla bla",
    			date: "Jun 24, 2020",
    			time: "05:21 PM"
    		},
    		{
    			event: "bla bla",
    			date: "Jun 19, 2020",
    			time: "04:21 AM"
    		},
    		{
    			event: "bla bla",
    			date: "Feb 20, 2020",
    			time: "04:41 PM"
    		}
    	];

    	let newEvent = "";
    	let newDate = "";
    	let newTime = "";
    	let event;
    	let date;
    	let time;

    	const handleAddition = () => {
    		$$invalidate(0, events_list = [...events_list, { event, date, time }]);
    		$$invalidate(3, event = "");
    		$$invalidate(1, date = "");
    		$$invalidate(2, time = "");
    	};

    	const handleDelete = e => {
    		console.log(e.detail);
    		$$invalidate(0, events_list = events_list.filter(s_event => s_event.event !== e.detail.event || s_event.date !== e.detail.date || s_event.time != e.detail.time));
    	};

    	// initialize
    	document.addEventListener("DOMContentLoaded", function () {
    		var elems = document.querySelectorAll(".datepicker");
    		var instances = M.Datepicker.init(elems, { format: "dd/mm/yyyy" });
    	});

    	document.addEventListener("DOMContentLoaded", function () {
    		var elems = document.querySelectorAll(".timepicker");
    		var instances = M.Timepicker.init(elems, { defaultTime: "now" });
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Schedule> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Schedule", $$slots, []);

    	function input0_input_handler() {
    		event = this.value;
    		$$invalidate(3, event);
    	}

    	function input1_input_handler() {
    		date = this.value;
    		$$invalidate(1, date);
    	}

    	function input2_input_handler() {
    		time = this.value;
    		$$invalidate(2, time);
    	}

    	$$self.$capture_state = () => ({
    		SchedEvent: ScheduledEvent,
    		events_list,
    		newEvent,
    		newDate,
    		newTime,
    		event,
    		date,
    		time,
    		handleAddition,
    		handleDelete
    	});

    	$$self.$inject_state = $$props => {
    		if ("events_list" in $$props) $$invalidate(0, events_list = $$props.events_list);
    		if ("newEvent" in $$props) newEvent = $$props.newEvent;
    		if ("newDate" in $$props) newDate = $$props.newDate;
    		if ("newTime" in $$props) newTime = $$props.newTime;
    		if ("event" in $$props) $$invalidate(3, event = $$props.event);
    		if ("date" in $$props) $$invalidate(1, date = $$props.date);
    		if ("time" in $$props) $$invalidate(2, time = $$props.time);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		events_list,
    		date,
    		time,
    		event,
    		handleAddition,
    		handleDelete,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Schedule extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Schedule",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/TeamUpdatesComponents/Update.svelte generated by Svelte v3.23.1 */

    const file$6 = "src/components/TeamUpdatesComponents/Update.svelte";

    function create_fragment$6(ctx) {
    	let li;
    	let div0;
    	let i;
    	let t1;
    	let t2_value = /*update*/ ctx[0].updateTitle + "";
    	let t2;
    	let t3;
    	let div1;
    	let span;
    	let t4_value = /*update*/ ctx[0].updateMsg + "";
    	let t4;

    	const block = {
    		c: function create() {
    			li = element("li");
    			div0 = element("div");
    			i = element("i");
    			i.textContent = "update";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			span = element("span");
    			t4 = text(t4_value);
    			attr_dev(i, "class", "material-icons green-text");
    			add_location(i, file$6, 11, 4, 263);
    			attr_dev(div0, "class", "collapsible-header");
    			add_location(div0, file$6, 10, 2, 226);
    			add_location(span, file$6, 15, 4, 382);
    			attr_dev(div1, "class", "collapsible-body");
    			add_location(div1, file$6, 14, 2, 347);
    			add_location(li, file$6, 9, 0, 219);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, div0);
    			append_dev(div0, i);
    			append_dev(div0, t1);
    			append_dev(div0, t2);
    			append_dev(li, t3);
    			append_dev(li, div1);
    			append_dev(div1, span);
    			append_dev(span, t4);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*update*/ 1 && t2_value !== (t2_value = /*update*/ ctx[0].updateTitle + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*update*/ 1 && t4_value !== (t4_value = /*update*/ ctx[0].updateMsg + "")) set_data_dev(t4, t4_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { update } = $$props;

    	document.addEventListener("DOMContentLoaded", function () {
    		var elems = document.querySelectorAll(".collapsible");
    		var instances = M.Collapsible.init(elems, {});
    	});

    	const writable_props = ["update"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Update> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Update", $$slots, []);

    	$$self.$set = $$props => {
    		if ("update" in $$props) $$invalidate(0, update = $$props.update);
    	};

    	$$self.$capture_state = () => ({ update });

    	$$self.$inject_state = $$props => {
    		if ("update" in $$props) $$invalidate(0, update = $$props.update);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [update];
    }

    class Update extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { update: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Update",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*update*/ ctx[0] === undefined && !("update" in props)) {
    			console.warn("<Update> was created without expected prop 'update'");
    		}
    	}

    	get update() {
    		throw new Error("<Update>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set update(value) {
    		throw new Error("<Update>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/TeamUpdatesComponents/TeamUpdate.svelte generated by Svelte v3.23.1 */
    const file$7 = "src/components/TeamUpdatesComponents/TeamUpdate.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	child_ctx[9] = i;
    	return child_ctx;
    }

    // (32:8) {#each Updates as update, i (i)}
    function create_each_block$2(key_1, ctx) {
    	let first;
    	let current;

    	const update = new Update({
    			props: { update: /*update*/ ctx[7] },
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(update.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(update, target, anchor);
    			current = true;
    		},
    		p: function update$1(ctx, dirty) {
    			const update_changes = {};
    			if (dirty & /*Updates*/ 2) update_changes.update = /*update*/ ctx[7];
    			update.$set(update_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(update.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(update.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(update, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(32:8) {#each Updates as update, i (i)}",
    		ctx
    	});

    	return block;
    }

    // (38:4) {#if accessLevel == 'manager'}
    function create_if_block(ctx) {
    	let div2;
    	let div0;
    	let input0;
    	let t0;
    	let label0;
    	let t2;
    	let div1;
    	let input1;
    	let t3;
    	let label1;
    	let t5;
    	let a;
    	let i;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			label0 = element("label");
    			label0.textContent = "Update Title";
    			t2 = space();
    			div1 = element("div");
    			input1 = element("input");
    			t3 = space();
    			label1 = element("label");
    			label1.textContent = "Update Message";
    			t5 = space();
    			a = element("a");
    			i = element("i");
    			i.textContent = "add";
    			attr_dev(input0, "id", "add-update-Title");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "validate");
    			add_location(input0, file$7, 40, 10, 979);
    			attr_dev(label0, "for", "add-update-Title");
    			add_location(label0, file$7, 45, 10, 1126);
    			attr_dev(div0, "class", "input-field inline s12 m5");
    			add_location(div0, file$7, 39, 8, 929);
    			attr_dev(input1, "id", "add-update-Msg");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "validate");
    			add_location(input1, file$7, 49, 10, 1251);
    			attr_dev(label1, "for", "add-update-Msg");
    			add_location(label1, file$7, 54, 10, 1394);
    			attr_dev(div1, "class", "input-field inline s12 m5");
    			add_location(div1, file$7, 48, 8, 1201);
    			attr_dev(i, "class", "material-icons green-text");
    			add_location(i, file$7, 58, 10, 1519);
    			attr_dev(a, "href", "#!");
    			add_location(a, file$7, 57, 8, 1469);
    			attr_dev(div2, "class", "card-action");
    			add_location(div2, file$7, 38, 6, 895);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, input0);
    			set_input_value(input0, /*newUpdateTitle*/ ctx[2]);
    			append_dev(div0, t0);
    			append_dev(div0, label0);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, input1);
    			set_input_value(input1, /*newUpdateMsg*/ ctx[3]);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(div2, t5);
    			append_dev(div2, a);
    			append_dev(a, i);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(a, "click", /*handleAddition*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*newUpdateTitle*/ 4 && input0.value !== /*newUpdateTitle*/ ctx[2]) {
    				set_input_value(input0, /*newUpdateTitle*/ ctx[2]);
    			}

    			if (dirty & /*newUpdateMsg*/ 8 && input1.value !== /*newUpdateMsg*/ ctx[3]) {
    				set_input_value(input1, /*newUpdateMsg*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(38:4) {#if accessLevel == 'manager'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let div2;
    	let div1;
    	let span;
    	let t1;
    	let div0;
    	let ul;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t2;
    	let current;
    	let each_value = /*Updates*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[9];
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	let if_block = /*accessLevel*/ ctx[0] == "manager" && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			span = element("span");
    			span.textContent = "Team Updates";
    			t1 = space();
    			div0 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(span, "class", "card-title");
    			add_location(span, file$7, 27, 4, 590);
    			attr_dev(ul, "class", "collapsible");
    			add_location(ul, file$7, 30, 6, 718);
    			attr_dev(div0, "class", "card-content box");
    			set_style(div0, "height", "20vh");
    			set_style(div0, "overflow", "auto");
    			add_location(div0, file$7, 29, 4, 640);
    			attr_dev(div1, "class", "card");
    			add_location(div1, file$7, 26, 2, 567);
    			attr_dev(div2, "class", "row");
    			add_location(div2, file$7, 25, 0, 547);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, span);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append_dev(div1, t2);
    			if (if_block) if_block.m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Updates*/ 2) {
    				const each_value = /*Updates*/ ctx[1];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ul, outro_and_destroy_block, create_each_block$2, null, get_each_context$2);
    				check_outros();
    			}

    			if (/*accessLevel*/ ctx[0] == "manager") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { accessLevel = "manager" } = $$props;

    	let Updates = [
    		{
    			updateTitle: "update1",
    			updateMsg: "bli blu bla"
    		},
    		{
    			updateTitle: "update2",
    			updateMsg: "bli blu bla"
    		},
    		{
    			updateTitle: "update3",
    			updateMsg: "bli blu bla"
    		}
    	];

    	let newUpdateTitle = "";
    	let newUpdateMsg = "";

    	const handleAddition = () => {
    		$$invalidate(1, Updates = [
    			...Updates,
    			{
    				updateTitle: newUpdateTitle,
    				updateMsg: newUpdateMsg
    			}
    		]);

    		$$invalidate(2, newUpdateTitle = "");
    		$$invalidate(3, newUpdateMsg = "");
    	};

    	const writable_props = ["accessLevel"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TeamUpdate> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("TeamUpdate", $$slots, []);

    	function input0_input_handler() {
    		newUpdateTitle = this.value;
    		$$invalidate(2, newUpdateTitle);
    	}

    	function input1_input_handler() {
    		newUpdateMsg = this.value;
    		$$invalidate(3, newUpdateMsg);
    	}

    	$$self.$set = $$props => {
    		if ("accessLevel" in $$props) $$invalidate(0, accessLevel = $$props.accessLevel);
    	};

    	$$self.$capture_state = () => ({
    		Update,
    		accessLevel,
    		Updates,
    		newUpdateTitle,
    		newUpdateMsg,
    		handleAddition
    	});

    	$$self.$inject_state = $$props => {
    		if ("accessLevel" in $$props) $$invalidate(0, accessLevel = $$props.accessLevel);
    		if ("Updates" in $$props) $$invalidate(1, Updates = $$props.Updates);
    		if ("newUpdateTitle" in $$props) $$invalidate(2, newUpdateTitle = $$props.newUpdateTitle);
    		if ("newUpdateMsg" in $$props) $$invalidate(3, newUpdateMsg = $$props.newUpdateMsg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		accessLevel,
    		Updates,
    		newUpdateTitle,
    		newUpdateMsg,
    		handleAddition,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class TeamUpdate extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { accessLevel: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TeamUpdate",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get accessLevel() {
    		throw new Error("<TeamUpdate>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set accessLevel(value) {
    		throw new Error("<TeamUpdate>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/LandingPage.svelte generated by Svelte v3.23.1 */
    const file$8 = "src/components/pages/LandingPage.svelte";

    function create_fragment$8(ctx) {
    	let div6;
    	let div0;
    	let t0;
    	let div5;
    	let div1;
    	let t1;
    	let div4;
    	let div2;
    	let t2;
    	let div3;
    	let current;
    	const todolst = new TODO_Lst({ $$inline: true });
    	const schedule = new Schedule({ $$inline: true });
    	const teamupdate0 = new TeamUpdate({ $$inline: true });
    	const teamupdate1 = new TeamUpdate({ $$inline: true });

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div0 = element("div");
    			create_component(todolst.$$.fragment);
    			t0 = space();
    			div5 = element("div");
    			div1 = element("div");
    			create_component(schedule.$$.fragment);
    			t1 = space();
    			div4 = element("div");
    			div2 = element("div");
    			create_component(teamupdate0.$$.fragment);
    			t2 = space();
    			div3 = element("div");
    			create_component(teamupdate1.$$.fragment);
    			attr_dev(div0, "class", "toDoList svelte-14qmuop");
    			add_location(div0, file$8, 8, 4, 255);
    			attr_dev(div1, "class", "schedule svelte-14qmuop");
    			add_location(div1, file$8, 13, 8, 351);
    			attr_dev(div2, "class", "update svelte-14qmuop");
    			add_location(div2, file$8, 18, 12, 465);
    			attr_dev(div3, "class", "News svelte-14qmuop");
    			add_location(div3, file$8, 22, 12, 552);
    			attr_dev(div4, "class", "innerBlock svelte-14qmuop");
    			add_location(div4, file$8, 17, 8, 426);
    			attr_dev(div5, "class", "MainBlock svelte-14qmuop");
    			add_location(div5, file$8, 12, 4, 317);
    			attr_dev(div6, "class", "container svelte-14qmuop");
    			add_location(div6, file$8, 7, 0, 225);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div0);
    			mount_component(todolst, div0, null);
    			append_dev(div6, t0);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			mount_component(schedule, div1, null);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			mount_component(teamupdate0, div2, null);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			mount_component(teamupdate1, div3, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(todolst.$$.fragment, local);
    			transition_in(schedule.$$.fragment, local);
    			transition_in(teamupdate0.$$.fragment, local);
    			transition_in(teamupdate1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(todolst.$$.fragment, local);
    			transition_out(schedule.$$.fragment, local);
    			transition_out(teamupdate0.$$.fragment, local);
    			transition_out(teamupdate1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_component(todolst);
    			destroy_component(schedule);
    			destroy_component(teamupdate0);
    			destroy_component(teamupdate1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LandingPage> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("LandingPage", $$slots, []);
    	$$self.$capture_state = () => ({ ToDoLst: TODO_Lst, Schedule, TeamUpdate });
    	return [];
    }

    class LandingPage extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LandingPage",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.1 */
    const file$9 = "src/App.svelte";

    // (16:1) {#if page == 0}
    function create_if_block$1(ctx) {
    	let current;
    	const landingpage = new LandingPage({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(landingpage.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(landingpage, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(landingpage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(landingpage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(landingpage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(16:1) {#if page == 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let main;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let current;
    	const header = new Header({ $$inline: true });
    	let if_block = /*page*/ ctx[0] == 0 && create_if_block$1(ctx);
    	const footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t1 = space();
    			div2 = element("div");
    			create_component(footer.$$.fragment);
    			attr_dev(div0, "class", "header box svelte-5rzhxi");
    			add_location(div0, file$9, 10, 1, 226);
    			attr_dev(div1, "class", "page box svelte-5rzhxi");
    			add_location(div1, file$9, 14, 1, 275);
    			attr_dev(div2, "class", "footer box svelte-5rzhxi");
    			add_location(div2, file$9, 21, 1, 352);
    			add_location(main, file$9, 8, 0, 217);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			mount_component(header, div0, null);
    			append_dev(main, t0);
    			append_dev(main, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(main, t1);
    			append_dev(main, div2);
    			mount_component(footer, div2, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(header);
    			if (if_block) if_block.d();
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let page = 0;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ Header, Footer, LandingPage, page });

    	$$self.$inject_state = $$props => {
    		if ("page" in $$props) $$invalidate(0, page = $$props.page);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [page];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var materialize = createCommonjsModule(function (module, exports) {
    /*!
     * Materialize v1.0.0 (http://materializecss.com)
     * Copyright 2014-2017 Materialize
     * MIT License (https://raw.githubusercontent.com/Dogfalo/materialize/master/LICENSE)
     */
    var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

    function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    /*! cash-dom 1.3.5, https://github.com/kenwheeler/cash @license MIT */
    (function (factory) {
      window.cash = factory();
    })(function () {
      var doc = document,
          win = window,
          ArrayProto = Array.prototype,
          slice = ArrayProto.slice,
          filter = ArrayProto.filter,
          push = ArrayProto.push;

      var noop = function () {},
          isFunction = function (item) {
        // @see https://crbug.com/568448
        return typeof item === typeof noop && item.call;
      },
          isString = function (item) {
        return typeof item === typeof "";
      };

      var idMatch = /^#[\w-]*$/,
          classMatch = /^\.[\w-]*$/,
          htmlMatch = /<.+>/,
          singlet = /^\w+$/;

      function find(selector, context) {
        context = context || doc;
        var elems = classMatch.test(selector) ? context.getElementsByClassName(selector.slice(1)) : singlet.test(selector) ? context.getElementsByTagName(selector) : context.querySelectorAll(selector);
        return elems;
      }

      var frag;
      function parseHTML(str) {
        if (!frag) {
          frag = doc.implementation.createHTMLDocument(null);
          var base = frag.createElement("base");
          base.href = doc.location.href;
          frag.head.appendChild(base);
        }

        frag.body.innerHTML = str;

        return frag.body.childNodes;
      }

      function onReady(fn) {
        if (doc.readyState !== "loading") {
          fn();
        } else {
          doc.addEventListener("DOMContentLoaded", fn);
        }
      }

      function Init(selector, context) {
        if (!selector) {
          return this;
        }

        // If already a cash collection, don't do any further processing
        if (selector.cash && selector !== win) {
          return selector;
        }

        var elems = selector,
            i = 0,
            length;

        if (isString(selector)) {
          elems = idMatch.test(selector) ?
          // If an ID use the faster getElementById check
          doc.getElementById(selector.slice(1)) : htmlMatch.test(selector) ?
          // If HTML, parse it into real elements
          parseHTML(selector) :
          // else use `find`
          find(selector, context);

          // If function, use as shortcut for DOM ready
        } else if (isFunction(selector)) {
          onReady(selector);return this;
        }

        if (!elems) {
          return this;
        }

        // If a single DOM element is passed in or received via ID, return the single element
        if (elems.nodeType || elems === win) {
          this[0] = elems;
          this.length = 1;
        } else {
          // Treat like an array and loop through each item.
          length = this.length = elems.length;
          for (; i < length; i++) {
            this[i] = elems[i];
          }
        }

        return this;
      }

      function cash(selector, context) {
        return new Init(selector, context);
      }

      var fn = cash.fn = cash.prototype = Init.prototype = { // jshint ignore:line
        cash: true,
        length: 0,
        push: push,
        splice: ArrayProto.splice,
        map: ArrayProto.map,
        init: Init
      };

      Object.defineProperty(fn, "constructor", { value: cash });

      cash.parseHTML = parseHTML;
      cash.noop = noop;
      cash.isFunction = isFunction;
      cash.isString = isString;

      cash.extend = fn.extend = function (target) {
        target = target || {};

        var args = slice.call(arguments),
            length = args.length,
            i = 1;

        if (args.length === 1) {
          target = this;
          i = 0;
        }

        for (; i < length; i++) {
          if (!args[i]) {
            continue;
          }
          for (var key in args[i]) {
            if (args[i].hasOwnProperty(key)) {
              target[key] = args[i][key];
            }
          }
        }

        return target;
      };

      function each(collection, callback) {
        var l = collection.length,
            i = 0;

        for (; i < l; i++) {
          if (callback.call(collection[i], collection[i], i, collection) === false) {
            break;
          }
        }
      }

      function matches(el, selector) {
        var m = el && (el.matches || el.webkitMatchesSelector || el.mozMatchesSelector || el.msMatchesSelector || el.oMatchesSelector);
        return !!m && m.call(el, selector);
      }

      function getCompareFunction(selector) {
        return (
          /* Use browser's `matches` function if string */
          isString(selector) ? matches :
          /* Match a cash element */
          selector.cash ? function (el) {
            return selector.is(el);
          } :
          /* Direct comparison */
          function (el, selector) {
            return el === selector;
          }
        );
      }

      function unique(collection) {
        return cash(slice.call(collection).filter(function (item, index, self) {
          return self.indexOf(item) === index;
        }));
      }

      cash.extend({
        merge: function (first, second) {
          var len = +second.length,
              i = first.length,
              j = 0;

          for (; j < len; i++, j++) {
            first[i] = second[j];
          }

          first.length = i;
          return first;
        },

        each: each,
        matches: matches,
        unique: unique,
        isArray: Array.isArray,
        isNumeric: function (n) {
          return !isNaN(parseFloat(n)) && isFinite(n);
        }

      });

      var uid = cash.uid = "_cash" + Date.now();

      function getDataCache(node) {
        return node[uid] = node[uid] || {};
      }

      function setData(node, key, value) {
        return getDataCache(node)[key] = value;
      }

      function getData(node, key) {
        var c = getDataCache(node);
        if (c[key] === undefined) {
          c[key] = node.dataset ? node.dataset[key] : cash(node).attr("data-" + key);
        }
        return c[key];
      }

      function removeData(node, key) {
        var c = getDataCache(node);
        if (c) {
          delete c[key];
        } else if (node.dataset) {
          delete node.dataset[key];
        } else {
          cash(node).removeAttr("data-" + name);
        }
      }

      fn.extend({
        data: function (name, value) {
          if (isString(name)) {
            return value === undefined ? getData(this[0], name) : this.each(function (v) {
              return setData(v, name, value);
            });
          }

          for (var key in name) {
            this.data(key, name[key]);
          }

          return this;
        },

        removeData: function (key) {
          return this.each(function (v) {
            return removeData(v, key);
          });
        }

      });

      var notWhiteMatch = /\S+/g;

      function getClasses(c) {
        return isString(c) && c.match(notWhiteMatch);
      }

      function hasClass(v, c) {
        return v.classList ? v.classList.contains(c) : new RegExp("(^| )" + c + "( |$)", "gi").test(v.className);
      }

      function addClass(v, c, spacedName) {
        if (v.classList) {
          v.classList.add(c);
        } else if (spacedName.indexOf(" " + c + " ")) {
          v.className += " " + c;
        }
      }

      function removeClass(v, c) {
        if (v.classList) {
          v.classList.remove(c);
        } else {
          v.className = v.className.replace(c, "");
        }
      }

      fn.extend({
        addClass: function (c) {
          var classes = getClasses(c);

          return classes ? this.each(function (v) {
            var spacedName = " " + v.className + " ";
            each(classes, function (c) {
              addClass(v, c, spacedName);
            });
          }) : this;
        },

        attr: function (name, value) {
          if (!name) {
            return undefined;
          }

          if (isString(name)) {
            if (value === undefined) {
              return this[0] ? this[0].getAttribute ? this[0].getAttribute(name) : this[0][name] : undefined;
            }

            return this.each(function (v) {
              if (v.setAttribute) {
                v.setAttribute(name, value);
              } else {
                v[name] = value;
              }
            });
          }

          for (var key in name) {
            this.attr(key, name[key]);
          }

          return this;
        },

        hasClass: function (c) {
          var check = false,
              classes = getClasses(c);
          if (classes && classes.length) {
            this.each(function (v) {
              check = hasClass(v, classes[0]);
              return !check;
            });
          }
          return check;
        },

        prop: function (name, value) {
          if (isString(name)) {
            return value === undefined ? this[0][name] : this.each(function (v) {
              v[name] = value;
            });
          }

          for (var key in name) {
            this.prop(key, name[key]);
          }

          return this;
        },

        removeAttr: function (name) {
          return this.each(function (v) {
            if (v.removeAttribute) {
              v.removeAttribute(name);
            } else {
              delete v[name];
            }
          });
        },

        removeClass: function (c) {
          if (!arguments.length) {
            return this.attr("class", "");
          }
          var classes = getClasses(c);
          return classes ? this.each(function (v) {
            each(classes, function (c) {
              removeClass(v, c);
            });
          }) : this;
        },

        removeProp: function (name) {
          return this.each(function (v) {
            delete v[name];
          });
        },

        toggleClass: function (c, state) {
          if (state !== undefined) {
            return this[state ? "addClass" : "removeClass"](c);
          }
          var classes = getClasses(c);
          return classes ? this.each(function (v) {
            var spacedName = " " + v.className + " ";
            each(classes, function (c) {
              if (hasClass(v, c)) {
                removeClass(v, c);
              } else {
                addClass(v, c, spacedName);
              }
            });
          }) : this;
        } });

      fn.extend({
        add: function (selector, context) {
          return unique(cash.merge(this, cash(selector, context)));
        },

        each: function (callback) {
          each(this, callback);
          return this;
        },

        eq: function (index) {
          return cash(this.get(index));
        },

        filter: function (selector) {
          if (!selector) {
            return this;
          }

          var comparator = isFunction(selector) ? selector : getCompareFunction(selector);

          return cash(filter.call(this, function (e) {
            return comparator(e, selector);
          }));
        },

        first: function () {
          return this.eq(0);
        },

        get: function (index) {
          if (index === undefined) {
            return slice.call(this);
          }
          return index < 0 ? this[index + this.length] : this[index];
        },

        index: function (elem) {
          var child = elem ? cash(elem)[0] : this[0],
              collection = elem ? this : cash(child).parent().children();
          return slice.call(collection).indexOf(child);
        },

        last: function () {
          return this.eq(-1);
        }

      });

      var camelCase = function () {
        var camelRegex = /(?:^\w|[A-Z]|\b\w)/g,
            whiteSpace = /[\s-_]+/g;
        return function (str) {
          return str.replace(camelRegex, function (letter, index) {
            return letter[index === 0 ? "toLowerCase" : "toUpperCase"]();
          }).replace(whiteSpace, "");
        };
      }();

      var getPrefixedProp = function () {
        var cache = {},
            doc = document,
            div = doc.createElement("div"),
            style = div.style;

        return function (prop) {
          prop = camelCase(prop);
          if (cache[prop]) {
            return cache[prop];
          }

          var ucProp = prop.charAt(0).toUpperCase() + prop.slice(1),
              prefixes = ["webkit", "moz", "ms", "o"],
              props = (prop + " " + prefixes.join(ucProp + " ") + ucProp).split(" ");

          each(props, function (p) {
            if (p in style) {
              cache[p] = prop = cache[prop] = p;
              return false;
            }
          });

          return cache[prop];
        };
      }();

      cash.prefixedProp = getPrefixedProp;
      cash.camelCase = camelCase;

      fn.extend({
        css: function (prop, value) {
          if (isString(prop)) {
            prop = getPrefixedProp(prop);
            return arguments.length > 1 ? this.each(function (v) {
              return v.style[prop] = value;
            }) : win.getComputedStyle(this[0])[prop];
          }

          for (var key in prop) {
            this.css(key, prop[key]);
          }

          return this;
        }

      });

      function compute(el, prop) {
        return parseInt(win.getComputedStyle(el[0], null)[prop], 10) || 0;
      }

      each(["Width", "Height"], function (v) {
        var lower = v.toLowerCase();

        fn[lower] = function () {
          return this[0].getBoundingClientRect()[lower];
        };

        fn["inner" + v] = function () {
          return this[0]["client" + v];
        };

        fn["outer" + v] = function (margins) {
          return this[0]["offset" + v] + (margins ? compute(this, "margin" + (v === "Width" ? "Left" : "Top")) + compute(this, "margin" + (v === "Width" ? "Right" : "Bottom")) : 0);
        };
      });

      function registerEvent(node, eventName, callback) {
        var eventCache = getData(node, "_cashEvents") || setData(node, "_cashEvents", {});
        eventCache[eventName] = eventCache[eventName] || [];
        eventCache[eventName].push(callback);
        node.addEventListener(eventName, callback);
      }

      function removeEvent(node, eventName, callback) {
        var events = getData(node, "_cashEvents"),
            eventCache = events && events[eventName],
            index;

        if (!eventCache) {
          return;
        }

        if (callback) {
          node.removeEventListener(eventName, callback);
          index = eventCache.indexOf(callback);
          if (index >= 0) {
            eventCache.splice(index, 1);
          }
        } else {
          each(eventCache, function (event) {
            node.removeEventListener(eventName, event);
          });
          eventCache = [];
        }
      }

      fn.extend({
        off: function (eventName, callback) {
          return this.each(function (v) {
            return removeEvent(v, eventName, callback);
          });
        },

        on: function (eventName, delegate, callback, runOnce) {
          // jshint ignore:line
          var originalCallback;
          if (!isString(eventName)) {
            for (var key in eventName) {
              this.on(key, delegate, eventName[key]);
            }
            return this;
          }

          if (isFunction(delegate)) {
            callback = delegate;
            delegate = null;
          }

          if (eventName === "ready") {
            onReady(callback);
            return this;
          }

          if (delegate) {
            originalCallback = callback;
            callback = function (e) {
              var t = e.target;
              while (!matches(t, delegate)) {
                if (t === this || t === null) {
                  return t = false;
                }

                t = t.parentNode;
              }

              if (t) {
                originalCallback.call(t, e);
              }
            };
          }

          return this.each(function (v) {
            var finalCallback = callback;
            if (runOnce) {
              finalCallback = function () {
                callback.apply(this, arguments);
                removeEvent(v, eventName, finalCallback);
              };
            }
            registerEvent(v, eventName, finalCallback);
          });
        },

        one: function (eventName, delegate, callback) {
          return this.on(eventName, delegate, callback, true);
        },

        ready: onReady,

        /**
         * Modified
         * Triggers browser event
         * @param String eventName
         * @param Object data - Add properties to event object
         */
        trigger: function (eventName, data) {
          if (document.createEvent) {
            var evt = document.createEvent('HTMLEvents');
            evt.initEvent(eventName, true, false);
            evt = this.extend(evt, data);
            return this.each(function (v) {
              return v.dispatchEvent(evt);
            });
          }
        }

      });

      function encode(name, value) {
        return "&" + encodeURIComponent(name) + "=" + encodeURIComponent(value).replace(/%20/g, "+");
      }

      function getSelectMultiple_(el) {
        var values = [];
        each(el.options, function (o) {
          if (o.selected) {
            values.push(o.value);
          }
        });
        return values.length ? values : null;
      }

      function getSelectSingle_(el) {
        var selectedIndex = el.selectedIndex;
        return selectedIndex >= 0 ? el.options[selectedIndex].value : null;
      }

      function getValue(el) {
        var type = el.type;
        if (!type) {
          return null;
        }
        switch (type.toLowerCase()) {
          case "select-one":
            return getSelectSingle_(el);
          case "select-multiple":
            return getSelectMultiple_(el);
          case "radio":
            return el.checked ? el.value : null;
          case "checkbox":
            return el.checked ? el.value : null;
          default:
            return el.value ? el.value : null;
        }
      }

      fn.extend({
        serialize: function () {
          var query = "";

          each(this[0].elements || this, function (el) {
            if (el.disabled || el.tagName === "FIELDSET") {
              return;
            }
            var name = el.name;
            switch (el.type.toLowerCase()) {
              case "file":
              case "reset":
              case "submit":
              case "button":
                break;
              case "select-multiple":
                var values = getValue(el);
                if (values !== null) {
                  each(values, function (value) {
                    query += encode(name, value);
                  });
                }
                break;
              default:
                var value = getValue(el);
                if (value !== null) {
                  query += encode(name, value);
                }
            }
          });

          return query.substr(1);
        },

        val: function (value) {
          if (value === undefined) {
            return getValue(this[0]);
          }

          return this.each(function (v) {
            return v.value = value;
          });
        }

      });

      function insertElement(el, child, prepend) {
        if (prepend) {
          var first = el.childNodes[0];
          el.insertBefore(child, first);
        } else {
          el.appendChild(child);
        }
      }

      function insertContent(parent, child, prepend) {
        var str = isString(child);

        if (!str && child.length) {
          each(child, function (v) {
            return insertContent(parent, v, prepend);
          });
          return;
        }

        each(parent, str ? function (v) {
          return v.insertAdjacentHTML(prepend ? "afterbegin" : "beforeend", child);
        } : function (v, i) {
          return insertElement(v, i === 0 ? child : child.cloneNode(true), prepend);
        });
      }

      fn.extend({
        after: function (selector) {
          cash(selector).insertAfter(this);
          return this;
        },

        append: function (content) {
          insertContent(this, content);
          return this;
        },

        appendTo: function (parent) {
          insertContent(cash(parent), this);
          return this;
        },

        before: function (selector) {
          cash(selector).insertBefore(this);
          return this;
        },

        clone: function () {
          return cash(this.map(function (v) {
            return v.cloneNode(true);
          }));
        },

        empty: function () {
          this.html("");
          return this;
        },

        html: function (content) {
          if (content === undefined) {
            return this[0].innerHTML;
          }
          var source = content.nodeType ? content[0].outerHTML : content;
          return this.each(function (v) {
            return v.innerHTML = source;
          });
        },

        insertAfter: function (selector) {
          var _this = this;

          cash(selector).each(function (el, i) {
            var parent = el.parentNode,
                sibling = el.nextSibling;
            _this.each(function (v) {
              parent.insertBefore(i === 0 ? v : v.cloneNode(true), sibling);
            });
          });

          return this;
        },

        insertBefore: function (selector) {
          var _this2 = this;
          cash(selector).each(function (el, i) {
            var parent = el.parentNode;
            _this2.each(function (v) {
              parent.insertBefore(i === 0 ? v : v.cloneNode(true), el);
            });
          });
          return this;
        },

        prepend: function (content) {
          insertContent(this, content, true);
          return this;
        },

        prependTo: function (parent) {
          insertContent(cash(parent), this, true);
          return this;
        },

        remove: function () {
          return this.each(function (v) {
            if (!!v.parentNode) {
              return v.parentNode.removeChild(v);
            }
          });
        },

        text: function (content) {
          if (content === undefined) {
            return this[0].textContent;
          }
          return this.each(function (v) {
            return v.textContent = content;
          });
        }

      });

      var docEl = doc.documentElement;

      fn.extend({
        position: function () {
          var el = this[0];
          return {
            left: el.offsetLeft,
            top: el.offsetTop
          };
        },

        offset: function () {
          var rect = this[0].getBoundingClientRect();
          return {
            top: rect.top + win.pageYOffset - docEl.clientTop,
            left: rect.left + win.pageXOffset - docEl.clientLeft
          };
        },

        offsetParent: function () {
          return cash(this[0].offsetParent);
        }

      });

      fn.extend({
        children: function (selector) {
          var elems = [];
          this.each(function (el) {
            push.apply(elems, el.children);
          });
          elems = unique(elems);

          return !selector ? elems : elems.filter(function (v) {
            return matches(v, selector);
          });
        },

        closest: function (selector) {
          if (!selector || this.length < 1) {
            return cash();
          }
          if (this.is(selector)) {
            return this.filter(selector);
          }
          return this.parent().closest(selector);
        },

        is: function (selector) {
          if (!selector) {
            return false;
          }

          var match = false,
              comparator = getCompareFunction(selector);

          this.each(function (el) {
            match = comparator(el, selector);
            return !match;
          });

          return match;
        },

        find: function (selector) {
          if (!selector || selector.nodeType) {
            return cash(selector && this.has(selector).length ? selector : null);
          }

          var elems = [];
          this.each(function (el) {
            push.apply(elems, find(selector, el));
          });

          return unique(elems);
        },

        has: function (selector) {
          var comparator = isString(selector) ? function (el) {
            return find(selector, el).length !== 0;
          } : function (el) {
            return el.contains(selector);
          };

          return this.filter(comparator);
        },

        next: function () {
          return cash(this[0].nextElementSibling);
        },

        not: function (selector) {
          if (!selector) {
            return this;
          }

          var comparator = getCompareFunction(selector);

          return this.filter(function (el) {
            return !comparator(el, selector);
          });
        },

        parent: function () {
          var result = [];

          this.each(function (item) {
            if (item && item.parentNode) {
              result.push(item.parentNode);
            }
          });

          return unique(result);
        },

        parents: function (selector) {
          var last,
              result = [];

          this.each(function (item) {
            last = item;

            while (last && last.parentNode && last !== doc.body.parentNode) {
              last = last.parentNode;

              if (!selector || selector && matches(last, selector)) {
                result.push(last);
              }
            }
          });

          return unique(result);
        },

        prev: function () {
          return cash(this[0].previousElementSibling);
        },

        siblings: function (selector) {
          var collection = this.parent().children(selector),
              el = this[0];

          return collection.filter(function (i) {
            return i !== el;
          });
        }

      });

      return cash;
    });
    var Component = function () {
      /**
       * Generic constructor for all components
       * @constructor
       * @param {Element} el
       * @param {Object} options
       */
      function Component(classDef, el, options) {
        _classCallCheck(this, Component);

        // Display error if el is valid HTML Element
        if (!(el instanceof Element)) {
          console.error(Error(el + ' is not an HTML Element'));
        }

        // If exists, destroy and reinitialize in child
        var ins = classDef.getInstance(el);
        if (!!ins) {
          ins.destroy();
        }

        this.el = el;
        this.$el = cash(el);
      }

      /**
       * Initializes components
       * @param {class} classDef
       * @param {Element | NodeList | jQuery} els
       * @param {Object} options
       */


      _createClass(Component, null, [{
        key: "init",
        value: function init(classDef, els, options) {
          var instances = null;
          if (els instanceof Element) {
            instances = new classDef(els, options);
          } else if (!!els && (els.jquery || els.cash || els instanceof NodeList)) {
            var instancesArr = [];
            for (var i = 0; i < els.length; i++) {
              instancesArr.push(new classDef(els[i], options));
            }
            instances = instancesArr;
          }

          return instances;
        }
      }]);

      return Component;
    }();
    (function (window) {
      if (window.Package) {
        M = {};
      } else {
        window.M = {};
      }

      // Check for jQuery
      M.jQueryLoaded = !!window.jQuery;
    })(window);

    // AMD
    if ( !exports.nodeType) {
      if ( !module.nodeType && module.exports) {
        exports = module.exports = M;
      }
      exports.default = M;
    }

    M.version = '1.0.0';

    M.keys = {
      TAB: 9,
      ENTER: 13,
      ESC: 27,
      ARROW_UP: 38,
      ARROW_DOWN: 40
    };

    /**
     * TabPress Keydown handler
     */
    M.tabPressed = false;
    M.keyDown = false;
    var docHandleKeydown = function (e) {
      M.keyDown = true;
      if (e.which === M.keys.TAB || e.which === M.keys.ARROW_DOWN || e.which === M.keys.ARROW_UP) {
        M.tabPressed = true;
      }
    };
    var docHandleKeyup = function (e) {
      M.keyDown = false;
      if (e.which === M.keys.TAB || e.which === M.keys.ARROW_DOWN || e.which === M.keys.ARROW_UP) {
        M.tabPressed = false;
      }
    };
    var docHandleFocus = function (e) {
      if (M.keyDown) {
        document.body.classList.add('keyboard-focused');
      }
    };
    var docHandleBlur = function (e) {
      document.body.classList.remove('keyboard-focused');
    };
    document.addEventListener('keydown', docHandleKeydown, true);
    document.addEventListener('keyup', docHandleKeyup, true);
    document.addEventListener('focus', docHandleFocus, true);
    document.addEventListener('blur', docHandleBlur, true);

    /**
     * Initialize jQuery wrapper for plugin
     * @param {Class} plugin  javascript class
     * @param {string} pluginName  jQuery plugin name
     * @param {string} classRef  Class reference name
     */
    M.initializeJqueryWrapper = function (plugin, pluginName, classRef) {
      jQuery.fn[pluginName] = function (methodOrOptions) {
        // Call plugin method if valid method name is passed in
        if (plugin.prototype[methodOrOptions]) {
          var params = Array.prototype.slice.call(arguments, 1);

          // Getter methods
          if (methodOrOptions.slice(0, 3) === 'get') {
            var instance = this.first()[0][classRef];
            return instance[methodOrOptions].apply(instance, params);
          }

          // Void methods
          return this.each(function () {
            var instance = this[classRef];
            instance[methodOrOptions].apply(instance, params);
          });

          // Initialize plugin if options or no argument is passed in
        } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
          plugin.init(this, arguments[0]);
          return this;
        }

        // Return error if an unrecognized  method name is passed in
        jQuery.error("Method " + methodOrOptions + " does not exist on jQuery." + pluginName);
      };
    };

    /**
     * Automatically initialize components
     * @param {Element} context  DOM Element to search within for components
     */
    M.AutoInit = function (context) {
      // Use document.body if no context is given
      var root = !!context ? context : document.body;

      var registry = {
        Autocomplete: root.querySelectorAll('.autocomplete:not(.no-autoinit)'),
        Carousel: root.querySelectorAll('.carousel:not(.no-autoinit)'),
        Chips: root.querySelectorAll('.chips:not(.no-autoinit)'),
        Collapsible: root.querySelectorAll('.collapsible:not(.no-autoinit)'),
        Datepicker: root.querySelectorAll('.datepicker:not(.no-autoinit)'),
        Dropdown: root.querySelectorAll('.dropdown-trigger:not(.no-autoinit)'),
        Materialbox: root.querySelectorAll('.materialboxed:not(.no-autoinit)'),
        Modal: root.querySelectorAll('.modal:not(.no-autoinit)'),
        Parallax: root.querySelectorAll('.parallax:not(.no-autoinit)'),
        Pushpin: root.querySelectorAll('.pushpin:not(.no-autoinit)'),
        ScrollSpy: root.querySelectorAll('.scrollspy:not(.no-autoinit)'),
        FormSelect: root.querySelectorAll('select:not(.no-autoinit)'),
        Sidenav: root.querySelectorAll('.sidenav:not(.no-autoinit)'),
        Tabs: root.querySelectorAll('.tabs:not(.no-autoinit)'),
        TapTarget: root.querySelectorAll('.tap-target:not(.no-autoinit)'),
        Timepicker: root.querySelectorAll('.timepicker:not(.no-autoinit)'),
        Tooltip: root.querySelectorAll('.tooltipped:not(.no-autoinit)'),
        FloatingActionButton: root.querySelectorAll('.fixed-action-btn:not(.no-autoinit)')
      };

      for (var pluginName in registry) {
        var plugin = M[pluginName];
        plugin.init(registry[pluginName]);
      }
    };

    /**
     * Generate approximated selector string for a jQuery object
     * @param {jQuery} obj  jQuery object to be parsed
     * @returns {string}
     */
    M.objectSelectorString = function (obj) {
      var tagStr = obj.prop('tagName') || '';
      var idStr = obj.attr('id') || '';
      var classStr = obj.attr('class') || '';
      return (tagStr + idStr + classStr).replace(/\s/g, '');
    };

    // Unique Random ID
    M.guid = function () {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      }
      return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
      };
    }();

    /**
     * Escapes hash from special characters
     * @param {string} hash  String returned from this.hash
     * @returns {string}
     */
    M.escapeHash = function (hash) {
      return hash.replace(/(:|\.|\[|\]|,|=|\/)/g, '\\$1');
    };

    M.elementOrParentIsFixed = function (element) {
      var $element = $(element);
      var $checkElements = $element.add($element.parents());
      var isFixed = false;
      $checkElements.each(function () {
        if ($(this).css('position') === 'fixed') {
          isFixed = true;
          return false;
        }
      });
      return isFixed;
    };

    /**
     * @typedef {Object} Edges
     * @property {Boolean} top  If the top edge was exceeded
     * @property {Boolean} right  If the right edge was exceeded
     * @property {Boolean} bottom  If the bottom edge was exceeded
     * @property {Boolean} left  If the left edge was exceeded
     */

    /**
     * @typedef {Object} Bounding
     * @property {Number} left  left offset coordinate
     * @property {Number} top  top offset coordinate
     * @property {Number} width
     * @property {Number} height
     */

    /**
     * Escapes hash from special characters
     * @param {Element} container  Container element that acts as the boundary
     * @param {Bounding} bounding  element bounding that is being checked
     * @param {Number} offset  offset from edge that counts as exceeding
     * @returns {Edges}
     */
    M.checkWithinContainer = function (container, bounding, offset) {
      var edges = {
        top: false,
        right: false,
        bottom: false,
        left: false
      };

      var containerRect = container.getBoundingClientRect();
      // If body element is smaller than viewport, use viewport height instead.
      var containerBottom = container === document.body ? Math.max(containerRect.bottom, window.innerHeight) : containerRect.bottom;

      var scrollLeft = container.scrollLeft;
      var scrollTop = container.scrollTop;

      var scrolledX = bounding.left - scrollLeft;
      var scrolledY = bounding.top - scrollTop;

      // Check for container and viewport for each edge
      if (scrolledX < containerRect.left + offset || scrolledX < offset) {
        edges.left = true;
      }

      if (scrolledX + bounding.width > containerRect.right - offset || scrolledX + bounding.width > window.innerWidth - offset) {
        edges.right = true;
      }

      if (scrolledY < containerRect.top + offset || scrolledY < offset) {
        edges.top = true;
      }

      if (scrolledY + bounding.height > containerBottom - offset || scrolledY + bounding.height > window.innerHeight - offset) {
        edges.bottom = true;
      }

      return edges;
    };

    M.checkPossibleAlignments = function (el, container, bounding, offset) {
      var canAlign = {
        top: true,
        right: true,
        bottom: true,
        left: true,
        spaceOnTop: null,
        spaceOnRight: null,
        spaceOnBottom: null,
        spaceOnLeft: null
      };

      var containerAllowsOverflow = getComputedStyle(container).overflow === 'visible';
      var containerRect = container.getBoundingClientRect();
      var containerHeight = Math.min(containerRect.height, window.innerHeight);
      var containerWidth = Math.min(containerRect.width, window.innerWidth);
      var elOffsetRect = el.getBoundingClientRect();

      var scrollLeft = container.scrollLeft;
      var scrollTop = container.scrollTop;

      var scrolledX = bounding.left - scrollLeft;
      var scrolledYTopEdge = bounding.top - scrollTop;
      var scrolledYBottomEdge = bounding.top + elOffsetRect.height - scrollTop;

      // Check for container and viewport for left
      canAlign.spaceOnRight = !containerAllowsOverflow ? containerWidth - (scrolledX + bounding.width) : window.innerWidth - (elOffsetRect.left + bounding.width);
      if (canAlign.spaceOnRight < 0) {
        canAlign.left = false;
      }

      // Check for container and viewport for Right
      canAlign.spaceOnLeft = !containerAllowsOverflow ? scrolledX - bounding.width + elOffsetRect.width : elOffsetRect.right - bounding.width;
      if (canAlign.spaceOnLeft < 0) {
        canAlign.right = false;
      }

      // Check for container and viewport for Top
      canAlign.spaceOnBottom = !containerAllowsOverflow ? containerHeight - (scrolledYTopEdge + bounding.height + offset) : window.innerHeight - (elOffsetRect.top + bounding.height + offset);
      if (canAlign.spaceOnBottom < 0) {
        canAlign.top = false;
      }

      // Check for container and viewport for Bottom
      canAlign.spaceOnTop = !containerAllowsOverflow ? scrolledYBottomEdge - (bounding.height - offset) : elOffsetRect.bottom - (bounding.height + offset);
      if (canAlign.spaceOnTop < 0) {
        canAlign.bottom = false;
      }

      return canAlign;
    };

    M.getOverflowParent = function (element) {
      if (element == null) {
        return null;
      }

      if (element === document.body || getComputedStyle(element).overflow !== 'visible') {
        return element;
      }

      return M.getOverflowParent(element.parentElement);
    };

    /**
     * Gets id of component from a trigger
     * @param {Element} trigger  trigger
     * @returns {string}
     */
    M.getIdFromTrigger = function (trigger) {
      var id = trigger.getAttribute('data-target');
      if (!id) {
        id = trigger.getAttribute('href');
        if (id) {
          id = id.slice(1);
        } else {
          id = '';
        }
      }
      return id;
    };

    /**
     * Multi browser support for document scroll top
     * @returns {Number}
     */
    M.getDocumentScrollTop = function () {
      return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    /**
     * Multi browser support for document scroll left
     * @returns {Number}
     */
    M.getDocumentScrollLeft = function () {
      return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    };

    /**
     * @typedef {Object} Edges
     * @property {Boolean} top  If the top edge was exceeded
     * @property {Boolean} right  If the right edge was exceeded
     * @property {Boolean} bottom  If the bottom edge was exceeded
     * @property {Boolean} left  If the left edge was exceeded
     */

    /**
     * @typedef {Object} Bounding
     * @property {Number} left  left offset coordinate
     * @property {Number} top  top offset coordinate
     * @property {Number} width
     * @property {Number} height
     */

    /**
     * Get time in ms
     * @license https://raw.github.com/jashkenas/underscore/master/LICENSE
     * @type {function}
     * @return {number}
     */
    var getTime = Date.now || function () {
      return new Date().getTime();
    };

    /**
     * Returns a function, that, when invoked, will only be triggered at most once
     * during a given window of time. Normally, the throttled function will run
     * as much as it can, without ever going more than once per `wait` duration;
     * but if you'd like to disable the execution on the leading edge, pass
     * `{leading: false}`. To disable execution on the trailing edge, ditto.
     * @license https://raw.github.com/jashkenas/underscore/master/LICENSE
     * @param {function} func
     * @param {number} wait
     * @param {Object=} options
     * @returns {Function}
     */
    M.throttle = function (func, wait, options) {
      var context = void 0,
          args = void 0,
          result = void 0;
      var timeout = null;
      var previous = 0;
      options || (options = {});
      var later = function () {
        previous = options.leading === false ? 0 : getTime();
        timeout = null;
        result = func.apply(context, args);
        context = args = null;
      };
      return function () {
        var now = getTime();
        if (!previous && options.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0) {
          clearTimeout(timeout);
          timeout = null;
          previous = now;
          result = func.apply(context, args);
          context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = setTimeout(later, remaining);
        }
        return result;
      };
    };
    var $jscomp = { scope: {} };$jscomp.defineProperty = "function" == typeof Object.defineProperties ? Object.defineProperty : function (e, r, p) {
      if (p.get || p.set) throw new TypeError("ES3 does not support getters and setters.");e != Array.prototype && e != Object.prototype && (e[r] = p.value);
    };$jscomp.getGlobal = function (e) {
      return "undefined" != typeof window && window === e ? e : "undefined" != typeof commonjsGlobal && null != commonjsGlobal ? commonjsGlobal : e;
    };$jscomp.global = $jscomp.getGlobal(commonjsGlobal);$jscomp.SYMBOL_PREFIX = "jscomp_symbol_";
    $jscomp.initSymbol = function () {
      $jscomp.initSymbol = function () {};$jscomp.global.Symbol || ($jscomp.global.Symbol = $jscomp.Symbol);
    };$jscomp.symbolCounter_ = 0;$jscomp.Symbol = function (e) {
      return $jscomp.SYMBOL_PREFIX + (e || "") + $jscomp.symbolCounter_++;
    };
    $jscomp.initSymbolIterator = function () {
      $jscomp.initSymbol();var e = $jscomp.global.Symbol.iterator;e || (e = $jscomp.global.Symbol.iterator = $jscomp.global.Symbol("iterator"));"function" != typeof Array.prototype[e] && $jscomp.defineProperty(Array.prototype, e, { configurable: !0, writable: !0, value: function () {
          return $jscomp.arrayIterator(this);
        } });$jscomp.initSymbolIterator = function () {};
    };$jscomp.arrayIterator = function (e) {
      var r = 0;return $jscomp.iteratorPrototype(function () {
        return r < e.length ? { done: !1, value: e[r++] } : { done: !0 };
      });
    };
    $jscomp.iteratorPrototype = function (e) {
      $jscomp.initSymbolIterator();e = { next: e };e[$jscomp.global.Symbol.iterator] = function () {
        return this;
      };return e;
    };$jscomp.array = $jscomp.array || {};$jscomp.iteratorFromArray = function (e, r) {
      $jscomp.initSymbolIterator();e instanceof String && (e += "");var p = 0,
          m = { next: function () {
          if (p < e.length) {
            var u = p++;return { value: r(u, e[u]), done: !1 };
          }m.next = function () {
            return { done: !0, value: void 0 };
          };return m.next();
        } };m[Symbol.iterator] = function () {
        return m;
      };return m;
    };
    $jscomp.polyfill = function (e, r, p, m) {
      if (r) {
        p = $jscomp.global;e = e.split(".");for (m = 0; m < e.length - 1; m++) {
          var u = e[m];u in p || (p[u] = {});p = p[u];
        }e = e[e.length - 1];m = p[e];r = r(m);r != m && null != r && $jscomp.defineProperty(p, e, { configurable: !0, writable: !0, value: r });
      }
    };$jscomp.polyfill("Array.prototype.keys", function (e) {
      return e ? e : function () {
        return $jscomp.iteratorFromArray(this, function (e) {
          return e;
        });
      };
    }, "es6-impl", "es3");var $jscomp$this = commonjsGlobal;
    (function (r) {
      M.anime = r();
    })(function () {
      function e(a) {
        if (!h.col(a)) try {
          return document.querySelectorAll(a);
        } catch (c) {}
      }function r(a, c) {
        for (var d = a.length, b = 2 <= arguments.length ? arguments[1] : void 0, f = [], n = 0; n < d; n++) {
          if (n in a) {
            var k = a[n];c.call(b, k, n, a) && f.push(k);
          }
        }return f;
      }function p(a) {
        return a.reduce(function (a, d) {
          return a.concat(h.arr(d) ? p(d) : d);
        }, []);
      }function m(a) {
        if (h.arr(a)) return a;
        h.str(a) && (a = e(a) || a);return a instanceof NodeList || a instanceof HTMLCollection ? [].slice.call(a) : [a];
      }function u(a, c) {
        return a.some(function (a) {
          return a === c;
        });
      }function C(a) {
        var c = {},
            d;for (d in a) {
          c[d] = a[d];
        }return c;
      }function D(a, c) {
        var d = C(a),
            b;for (b in a) {
          d[b] = c.hasOwnProperty(b) ? c[b] : a[b];
        }return d;
      }function z(a, c) {
        var d = C(a),
            b;for (b in c) {
          d[b] = h.und(a[b]) ? c[b] : a[b];
        }return d;
      }function T(a) {
        a = a.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, function (a, c, d, k) {
          return c + c + d + d + k + k;
        });var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a);
        a = parseInt(c[1], 16);var d = parseInt(c[2], 16),
            c = parseInt(c[3], 16);return "rgba(" + a + "," + d + "," + c + ",1)";
      }function U(a) {
        function c(a, c, b) {
          0 > b && (b += 1);1 < b && --b;return b < 1 / 6 ? a + 6 * (c - a) * b : .5 > b ? c : b < 2 / 3 ? a + (c - a) * (2 / 3 - b) * 6 : a;
        }var d = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(a) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(a);a = parseInt(d[1]) / 360;var b = parseInt(d[2]) / 100,
            f = parseInt(d[3]) / 100,
            d = d[4] || 1;if (0 == b) f = b = a = f;else {
          var n = .5 > f ? f * (1 + b) : f + b - f * b,
              k = 2 * f - n,
              f = c(k, n, a + 1 / 3),
              b = c(k, n, a);a = c(k, n, a - 1 / 3);
        }return "rgba(" + 255 * f + "," + 255 * b + "," + 255 * a + "," + d + ")";
      }function y(a) {
        if (a = /([\+\-]?[0-9#\.]+)(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(a)) return a[2];
      }function V(a) {
        if (-1 < a.indexOf("translate") || "perspective" === a) return "px";if (-1 < a.indexOf("rotate") || -1 < a.indexOf("skew")) return "deg";
      }function I(a, c) {
        return h.fnc(a) ? a(c.target, c.id, c.total) : a;
      }function E(a, c) {
        if (c in a.style) return getComputedStyle(a).getPropertyValue(c.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()) || "0";
      }function J(a, c) {
        if (h.dom(a) && u(W, c)) return "transform";if (h.dom(a) && (a.getAttribute(c) || h.svg(a) && a[c])) return "attribute";if (h.dom(a) && "transform" !== c && E(a, c)) return "css";if (null != a[c]) return "object";
      }function X(a, c) {
        var d = V(c),
            d = -1 < c.indexOf("scale") ? 1 : 0 + d;a = a.style.transform;if (!a) return d;for (var b = [], f = [], n = [], k = /(\w+)\((.+?)\)/g; b = k.exec(a);) {
          f.push(b[1]), n.push(b[2]);
        }a = r(n, function (a, b) {
          return f[b] === c;
        });return a.length ? a[0] : d;
      }function K(a, c) {
        switch (J(a, c)) {case "transform":
            return X(a, c);case "css":
            return E(a, c);case "attribute":
            return a.getAttribute(c);}return a[c] || 0;
      }function L(a, c) {
        var d = /^(\*=|\+=|-=)/.exec(a);if (!d) return a;var b = y(a) || 0;c = parseFloat(c);a = parseFloat(a.replace(d[0], ""));switch (d[0][0]) {case "+":
            return c + a + b;case "-":
            return c - a + b;case "*":
            return c * a + b;}
      }function F(a, c) {
        return Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
      }function M(a) {
        a = a.points;for (var c = 0, d, b = 0; b < a.numberOfItems; b++) {
          var f = a.getItem(b);0 < b && (c += F(d, f));d = f;
        }return c;
      }function N(a) {
        if (a.getTotalLength) return a.getTotalLength();switch (a.tagName.toLowerCase()) {case "circle":
            return 2 * Math.PI * a.getAttribute("r");case "rect":
            return 2 * a.getAttribute("width") + 2 * a.getAttribute("height");case "line":
            return F({ x: a.getAttribute("x1"), y: a.getAttribute("y1") }, { x: a.getAttribute("x2"), y: a.getAttribute("y2") });case "polyline":
            return M(a);case "polygon":
            var c = a.points;return M(a) + F(c.getItem(c.numberOfItems - 1), c.getItem(0));}
      }function Y(a, c) {
        function d(b) {
          b = void 0 === b ? 0 : b;return a.el.getPointAtLength(1 <= c + b ? c + b : 0);
        }var b = d(),
            f = d(-1),
            n = d(1);switch (a.property) {case "x":
            return b.x;case "y":
            return b.y;
          case "angle":
            return 180 * Math.atan2(n.y - f.y, n.x - f.x) / Math.PI;}
      }function O(a, c) {
        var d = /-?\d*\.?\d+/g,
            b;b = h.pth(a) ? a.totalLength : a;if (h.col(b)) {
          if (h.rgb(b)) {
            var f = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(b);b = f ? "rgba(" + f[1] + ",1)" : b;
          } else b = h.hex(b) ? T(b) : h.hsl(b) ? U(b) : void 0;
        } else f = (f = y(b)) ? b.substr(0, b.length - f.length) : b, b = c && !/\s/g.test(b) ? f + c : f;b += "";return { original: b, numbers: b.match(d) ? b.match(d).map(Number) : [0], strings: h.str(a) || c ? b.split(d) : [] };
      }function P(a) {
        a = a ? p(h.arr(a) ? a.map(m) : m(a)) : [];return r(a, function (a, d, b) {
          return b.indexOf(a) === d;
        });
      }function Z(a) {
        var c = P(a);return c.map(function (a, b) {
          return { target: a, id: b, total: c.length };
        });
      }function aa(a, c) {
        var d = C(c);if (h.arr(a)) {
          var b = a.length;2 !== b || h.obj(a[0]) ? h.fnc(c.duration) || (d.duration = c.duration / b) : a = { value: a };
        }return m(a).map(function (a, b) {
          b = b ? 0 : c.delay;a = h.obj(a) && !h.pth(a) ? a : { value: a };h.und(a.delay) && (a.delay = b);return a;
        }).map(function (a) {
          return z(a, d);
        });
      }function ba(a, c) {
        var d = {},
            b;for (b in a) {
          var f = I(a[b], c);h.arr(f) && (f = f.map(function (a) {
            return I(a, c);
          }), 1 === f.length && (f = f[0]));d[b] = f;
        }d.duration = parseFloat(d.duration);d.delay = parseFloat(d.delay);return d;
      }function ca(a) {
        return h.arr(a) ? A.apply(this, a) : Q[a];
      }function da(a, c) {
        var d;return a.tweens.map(function (b) {
          b = ba(b, c);var f = b.value,
              e = K(c.target, a.name),
              k = d ? d.to.original : e,
              k = h.arr(f) ? f[0] : k,
              w = L(h.arr(f) ? f[1] : f, k),
              e = y(w) || y(k) || y(e);b.from = O(k, e);b.to = O(w, e);b.start = d ? d.end : a.offset;b.end = b.start + b.delay + b.duration;b.easing = ca(b.easing);b.elasticity = (1E3 - Math.min(Math.max(b.elasticity, 1), 999)) / 1E3;b.isPath = h.pth(f);b.isColor = h.col(b.from.original);b.isColor && (b.round = 1);return d = b;
        });
      }function ea(a, c) {
        return r(p(a.map(function (a) {
          return c.map(function (b) {
            var c = J(a.target, b.name);if (c) {
              var d = da(b, a);b = { type: c, property: b.name, animatable: a, tweens: d, duration: d[d.length - 1].end, delay: d[0].delay };
            } else b = void 0;return b;
          });
        })), function (a) {
          return !h.und(a);
        });
      }function R(a, c, d, b) {
        var f = "delay" === a;return c.length ? (f ? Math.min : Math.max).apply(Math, c.map(function (b) {
          return b[a];
        })) : f ? b.delay : d.offset + b.delay + b.duration;
      }function fa(a) {
        var c = D(ga, a),
            d = D(S, a),
            b = Z(a.targets),
            f = [],
            e = z(c, d),
            k;for (k in a) {
          e.hasOwnProperty(k) || "targets" === k || f.push({ name: k, offset: e.offset, tweens: aa(a[k], d) });
        }a = ea(b, f);return z(c, { children: [], animatables: b, animations: a, duration: R("duration", a, c, d), delay: R("delay", a, c, d) });
      }function q(a) {
        function c() {
          return window.Promise && new Promise(function (a) {
            return p = a;
          });
        }function d(a) {
          return g.reversed ? g.duration - a : a;
        }function b(a) {
          for (var b = 0, c = {}, d = g.animations, f = d.length; b < f;) {
            var e = d[b],
                k = e.animatable,
                h = e.tweens,
                n = h.length - 1,
                l = h[n];n && (l = r(h, function (b) {
              return a < b.end;
            })[0] || l);for (var h = Math.min(Math.max(a - l.start - l.delay, 0), l.duration) / l.duration, w = isNaN(h) ? 1 : l.easing(h, l.elasticity), h = l.to.strings, p = l.round, n = [], m = void 0, m = l.to.numbers.length, t = 0; t < m; t++) {
              var x = void 0,
                  x = l.to.numbers[t],
                  q = l.from.numbers[t],
                  x = l.isPath ? Y(l.value, w * x) : q + w * (x - q);p && (l.isColor && 2 < t || (x = Math.round(x * p) / p));n.push(x);
            }if (l = h.length) for (m = h[0], w = 0; w < l; w++) {
              p = h[w + 1], t = n[w], isNaN(t) || (m = p ? m + (t + p) : m + (t + " "));
            } else m = n[0];ha[e.type](k.target, e.property, m, c, k.id);e.currentValue = m;b++;
          }if (b = Object.keys(c).length) for (d = 0; d < b; d++) {
            H || (H = E(document.body, "transform") ? "transform" : "-webkit-transform"), g.animatables[d].target.style[H] = c[d].join(" ");
          }g.currentTime = a;g.progress = a / g.duration * 100;
        }function f(a) {
          if (g[a]) g[a](g);
        }function e() {
          g.remaining && !0 !== g.remaining && g.remaining--;
        }function k(a) {
          var k = g.duration,
              n = g.offset,
              w = n + g.delay,
              r = g.currentTime,
              x = g.reversed,
              q = d(a);if (g.children.length) {
            var u = g.children,
                v = u.length;
            if (q >= g.currentTime) for (var G = 0; G < v; G++) {
              u[G].seek(q);
            } else for (; v--;) {
              u[v].seek(q);
            }
          }if (q >= w || !k) g.began || (g.began = !0, f("begin")), f("run");if (q > n && q < k) b(q);else if (q <= n && 0 !== r && (b(0), x && e()), q >= k && r !== k || !k) b(k), x || e();f("update");a >= k && (g.remaining ? (t = h, "alternate" === g.direction && (g.reversed = !g.reversed)) : (g.pause(), g.completed || (g.completed = !0, f("complete"), "Promise" in window && (p(), m = c()))), l = 0);
        }a = void 0 === a ? {} : a;var h,
            t,
            l = 0,
            p = null,
            m = c(),
            g = fa(a);g.reset = function () {
          var a = g.direction,
              c = g.loop;g.currentTime = 0;g.progress = 0;g.paused = !0;g.began = !1;g.completed = !1;g.reversed = "reverse" === a;g.remaining = "alternate" === a && 1 === c ? 2 : c;b(0);for (a = g.children.length; a--;) {
            g.children[a].reset();
          }
        };g.tick = function (a) {
          h = a;t || (t = h);k((l + h - t) * q.speed);
        };g.seek = function (a) {
          k(d(a));
        };g.pause = function () {
          var a = v.indexOf(g);-1 < a && v.splice(a, 1);g.paused = !0;
        };g.play = function () {
          g.paused && (g.paused = !1, t = 0, l = d(g.currentTime), v.push(g), B || ia());
        };g.reverse = function () {
          g.reversed = !g.reversed;t = 0;l = d(g.currentTime);
        };g.restart = function () {
          g.pause();
          g.reset();g.play();
        };g.finished = m;g.reset();g.autoplay && g.play();return g;
      }var ga = { update: void 0, begin: void 0, run: void 0, complete: void 0, loop: 1, direction: "normal", autoplay: !0, offset: 0 },
          S = { duration: 1E3, delay: 0, easing: "easeOutElastic", elasticity: 500, round: 0 },
          W = "translateX translateY translateZ rotate rotateX rotateY rotateZ scale scaleX scaleY scaleZ skewX skewY perspective".split(" "),
          H,
          h = { arr: function (a) {
          return Array.isArray(a);
        }, obj: function (a) {
          return -1 < Object.prototype.toString.call(a).indexOf("Object");
        },
        pth: function (a) {
          return h.obj(a) && a.hasOwnProperty("totalLength");
        }, svg: function (a) {
          return a instanceof SVGElement;
        }, dom: function (a) {
          return a.nodeType || h.svg(a);
        }, str: function (a) {
          return "string" === typeof a;
        }, fnc: function (a) {
          return "function" === typeof a;
        }, und: function (a) {
          return "undefined" === typeof a;
        }, hex: function (a) {
          return (/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a)
          );
        }, rgb: function (a) {
          return (/^rgb/.test(a)
          );
        }, hsl: function (a) {
          return (/^hsl/.test(a)
          );
        }, col: function (a) {
          return h.hex(a) || h.rgb(a) || h.hsl(a);
        } },
          A = function () {
        function a(a, d, b) {
          return (((1 - 3 * b + 3 * d) * a + (3 * b - 6 * d)) * a + 3 * d) * a;
        }return function (c, d, b, f) {
          if (0 <= c && 1 >= c && 0 <= b && 1 >= b) {
            var e = new Float32Array(11);if (c !== d || b !== f) for (var k = 0; 11 > k; ++k) {
              e[k] = a(.1 * k, c, b);
            }return function (k) {
              if (c === d && b === f) return k;if (0 === k) return 0;if (1 === k) return 1;for (var h = 0, l = 1; 10 !== l && e[l] <= k; ++l) {
                h += .1;
              }--l;var l = h + (k - e[l]) / (e[l + 1] - e[l]) * .1,
                  n = 3 * (1 - 3 * b + 3 * c) * l * l + 2 * (3 * b - 6 * c) * l + 3 * c;if (.001 <= n) {
                for (h = 0; 4 > h; ++h) {
                  n = 3 * (1 - 3 * b + 3 * c) * l * l + 2 * (3 * b - 6 * c) * l + 3 * c;if (0 === n) break;var m = a(l, c, b) - k,
                      l = l - m / n;
                }k = l;
              } else if (0 === n) k = l;else {
                var l = h,
                    h = h + .1,
                    g = 0;do {
                  m = l + (h - l) / 2, n = a(m, c, b) - k, 0 < n ? h = m : l = m;
                } while (1e-7 < Math.abs(n) && 10 > ++g);k = m;
              }return a(k, d, f);
            };
          }
        };
      }(),
          Q = function () {
        function a(a, b) {
          return 0 === a || 1 === a ? a : -Math.pow(2, 10 * (a - 1)) * Math.sin(2 * (a - 1 - b / (2 * Math.PI) * Math.asin(1)) * Math.PI / b);
        }var c = "Quad Cubic Quart Quint Sine Expo Circ Back Elastic".split(" "),
            d = { In: [[.55, .085, .68, .53], [.55, .055, .675, .19], [.895, .03, .685, .22], [.755, .05, .855, .06], [.47, 0, .745, .715], [.95, .05, .795, .035], [.6, .04, .98, .335], [.6, -.28, .735, .045], a], Out: [[.25, .46, .45, .94], [.215, .61, .355, 1], [.165, .84, .44, 1], [.23, 1, .32, 1], [.39, .575, .565, 1], [.19, 1, .22, 1], [.075, .82, .165, 1], [.175, .885, .32, 1.275], function (b, c) {
            return 1 - a(1 - b, c);
          }], InOut: [[.455, .03, .515, .955], [.645, .045, .355, 1], [.77, 0, .175, 1], [.86, 0, .07, 1], [.445, .05, .55, .95], [1, 0, 0, 1], [.785, .135, .15, .86], [.68, -.55, .265, 1.55], function (b, c) {
            return .5 > b ? a(2 * b, c) / 2 : 1 - a(-2 * b + 2, c) / 2;
          }] },
            b = { linear: A(.25, .25, .75, .75) },
            f = {},
            e;for (e in d) {
          f.type = e, d[f.type].forEach(function (a) {
            return function (d, f) {
              b["ease" + a.type + c[f]] = h.fnc(d) ? d : A.apply($jscomp$this, d);
            };
          }(f)), f = { type: f.type };
        }return b;
      }(),
          ha = { css: function (a, c, d) {
          return a.style[c] = d;
        }, attribute: function (a, c, d) {
          return a.setAttribute(c, d);
        }, object: function (a, c, d) {
          return a[c] = d;
        }, transform: function (a, c, d, b, f) {
          b[f] || (b[f] = []);b[f].push(c + "(" + d + ")");
        } },
          v = [],
          B = 0,
          ia = function () {
        function a() {
          B = requestAnimationFrame(c);
        }function c(c) {
          var b = v.length;if (b) {
            for (var d = 0; d < b;) {
              v[d] && v[d].tick(c), d++;
            }a();
          } else cancelAnimationFrame(B), B = 0;
        }return a;
      }();q.version = "2.2.0";q.speed = 1;q.running = v;q.remove = function (a) {
        a = P(a);for (var c = v.length; c--;) {
          for (var d = v[c], b = d.animations, f = b.length; f--;) {
            u(a, b[f].animatable.target) && (b.splice(f, 1), b.length || d.pause());
          }
        }
      };q.getValue = K;q.path = function (a, c) {
        var d = h.str(a) ? e(a)[0] : a,
            b = c || 100;return function (a) {
          return { el: d, property: a, totalLength: N(d) * (b / 100) };
        };
      };q.setDashoffset = function (a) {
        var c = N(a);a.setAttribute("stroke-dasharray", c);return c;
      };q.bezier = A;q.easings = Q;q.timeline = function (a) {
        var c = q(a);c.pause();c.duration = 0;c.add = function (d) {
          c.children.forEach(function (a) {
            a.began = !0;a.completed = !0;
          });m(d).forEach(function (b) {
            var d = z(b, D(S, a || {}));d.targets = d.targets || a.targets;b = c.duration;var e = d.offset;d.autoplay = !1;d.direction = c.direction;d.offset = h.und(e) ? b : L(e, b);c.began = !0;c.completed = !0;c.seek(d.offset);d = q(d);d.began = !0;d.completed = !0;d.duration > b && (c.duration = d.duration);c.children.push(d);
          });c.seek(0);c.reset();c.autoplay && c.restart();return c;
        };return c;
      };q.random = function (a, c) {
        return Math.floor(Math.random() * (c - a + 1)) + a;
      };return q;
    });
    (function ($, anim) {

      var _defaults = {
        accordion: true,
        onOpenStart: undefined,
        onOpenEnd: undefined,
        onCloseStart: undefined,
        onCloseEnd: undefined,
        inDuration: 300,
        outDuration: 300
      };

      /**
       * @class
       *
       */

      var Collapsible = function (_Component) {
        _inherits(Collapsible, _Component);

        /**
         * Construct Collapsible instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Collapsible(el, options) {
          _classCallCheck(this, Collapsible);

          var _this3 = _possibleConstructorReturn(this, (Collapsible.__proto__ || Object.getPrototypeOf(Collapsible)).call(this, Collapsible, el, options));

          _this3.el.M_Collapsible = _this3;

          /**
           * Options for the collapsible
           * @member Collapsible#options
           * @prop {Boolean} [accordion=false] - Type of the collapsible
           * @prop {Function} onOpenStart - Callback function called before collapsible is opened
           * @prop {Function} onOpenEnd - Callback function called after collapsible is opened
           * @prop {Function} onCloseStart - Callback function called before collapsible is closed
           * @prop {Function} onCloseEnd - Callback function called after collapsible is closed
           * @prop {Number} inDuration - Transition in duration in milliseconds.
           * @prop {Number} outDuration - Transition duration in milliseconds.
           */
          _this3.options = $.extend({}, Collapsible.defaults, options);

          // Setup tab indices
          _this3.$headers = _this3.$el.children('li').children('.collapsible-header');
          _this3.$headers.attr('tabindex', 0);

          _this3._setupEventHandlers();

          // Open first active
          var $activeBodies = _this3.$el.children('li.active').children('.collapsible-body');
          if (_this3.options.accordion) {
            // Handle Accordion
            $activeBodies.first().css('display', 'block');
          } else {
            // Handle Expandables
            $activeBodies.css('display', 'block');
          }
          return _this3;
        }

        _createClass(Collapsible, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.el.M_Collapsible = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            var _this4 = this;

            this._handleCollapsibleClickBound = this._handleCollapsibleClick.bind(this);
            this._handleCollapsibleKeydownBound = this._handleCollapsibleKeydown.bind(this);
            this.el.addEventListener('click', this._handleCollapsibleClickBound);
            this.$headers.each(function (header) {
              header.addEventListener('keydown', _this4._handleCollapsibleKeydownBound);
            });
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            var _this5 = this;

            this.el.removeEventListener('click', this._handleCollapsibleClickBound);
            this.$headers.each(function (header) {
              header.removeEventListener('keydown', _this5._handleCollapsibleKeydownBound);
            });
          }

          /**
           * Handle Collapsible Click
           * @param {Event} e
           */

        }, {
          key: "_handleCollapsibleClick",
          value: function _handleCollapsibleClick(e) {
            var $header = $(e.target).closest('.collapsible-header');
            if (e.target && $header.length) {
              var $collapsible = $header.closest('.collapsible');
              if ($collapsible[0] === this.el) {
                var $collapsibleLi = $header.closest('li');
                var $collapsibleLis = $collapsible.children('li');
                var isActive = $collapsibleLi[0].classList.contains('active');
                var index = $collapsibleLis.index($collapsibleLi);

                if (isActive) {
                  this.close(index);
                } else {
                  this.open(index);
                }
              }
            }
          }

          /**
           * Handle Collapsible Keydown
           * @param {Event} e
           */

        }, {
          key: "_handleCollapsibleKeydown",
          value: function _handleCollapsibleKeydown(e) {
            if (e.keyCode === 13) {
              this._handleCollapsibleClickBound(e);
            }
          }

          /**
           * Animate in collapsible slide
           * @param {Number} index - 0th index of slide
           */

        }, {
          key: "_animateIn",
          value: function _animateIn(index) {
            var _this6 = this;

            var $collapsibleLi = this.$el.children('li').eq(index);
            if ($collapsibleLi.length) {
              var $body = $collapsibleLi.children('.collapsible-body');

              anim.remove($body[0]);
              $body.css({
                display: 'block',
                overflow: 'hidden',
                height: 0,
                paddingTop: '',
                paddingBottom: ''
              });

              var pTop = $body.css('padding-top');
              var pBottom = $body.css('padding-bottom');
              var finalHeight = $body[0].scrollHeight;
              $body.css({
                paddingTop: 0,
                paddingBottom: 0
              });

              anim({
                targets: $body[0],
                height: finalHeight,
                paddingTop: pTop,
                paddingBottom: pBottom,
                duration: this.options.inDuration,
                easing: 'easeInOutCubic',
                complete: function (anim) {
                  $body.css({
                    overflow: '',
                    paddingTop: '',
                    paddingBottom: '',
                    height: ''
                  });

                  // onOpenEnd callback
                  if (typeof _this6.options.onOpenEnd === 'function') {
                    _this6.options.onOpenEnd.call(_this6, $collapsibleLi[0]);
                  }
                }
              });
            }
          }

          /**
           * Animate out collapsible slide
           * @param {Number} index - 0th index of slide to open
           */

        }, {
          key: "_animateOut",
          value: function _animateOut(index) {
            var _this7 = this;

            var $collapsibleLi = this.$el.children('li').eq(index);
            if ($collapsibleLi.length) {
              var $body = $collapsibleLi.children('.collapsible-body');
              anim.remove($body[0]);
              $body.css('overflow', 'hidden');
              anim({
                targets: $body[0],
                height: 0,
                paddingTop: 0,
                paddingBottom: 0,
                duration: this.options.outDuration,
                easing: 'easeInOutCubic',
                complete: function () {
                  $body.css({
                    height: '',
                    overflow: '',
                    padding: '',
                    display: ''
                  });

                  // onCloseEnd callback
                  if (typeof _this7.options.onCloseEnd === 'function') {
                    _this7.options.onCloseEnd.call(_this7, $collapsibleLi[0]);
                  }
                }
              });
            }
          }

          /**
           * Open Collapsible
           * @param {Number} index - 0th index of slide
           */

        }, {
          key: "open",
          value: function open(index) {
            var _this8 = this;

            var $collapsibleLi = this.$el.children('li').eq(index);
            if ($collapsibleLi.length && !$collapsibleLi[0].classList.contains('active')) {
              // onOpenStart callback
              if (typeof this.options.onOpenStart === 'function') {
                this.options.onOpenStart.call(this, $collapsibleLi[0]);
              }

              // Handle accordion behavior
              if (this.options.accordion) {
                var $collapsibleLis = this.$el.children('li');
                var $activeLis = this.$el.children('li.active');
                $activeLis.each(function (el) {
                  var index = $collapsibleLis.index($(el));
                  _this8.close(index);
                });
              }

              // Animate in
              $collapsibleLi[0].classList.add('active');
              this._animateIn(index);
            }
          }

          /**
           * Close Collapsible
           * @param {Number} index - 0th index of slide
           */

        }, {
          key: "close",
          value: function close(index) {
            var $collapsibleLi = this.$el.children('li').eq(index);
            if ($collapsibleLi.length && $collapsibleLi[0].classList.contains('active')) {
              // onCloseStart callback
              if (typeof this.options.onCloseStart === 'function') {
                this.options.onCloseStart.call(this, $collapsibleLi[0]);
              }

              // Animate out
              $collapsibleLi[0].classList.remove('active');
              this._animateOut(index);
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Collapsible.__proto__ || Object.getPrototypeOf(Collapsible), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Collapsible;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Collapsible;
      }(Component);

      M.Collapsible = Collapsible;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Collapsible, 'collapsible', 'M_Collapsible');
      }
    })(cash, M.anime);
    (function ($, anim) {

      var _defaults = {
        alignment: 'left',
        autoFocus: true,
        constrainWidth: true,
        container: null,
        coverTrigger: true,
        closeOnClick: true,
        hover: false,
        inDuration: 150,
        outDuration: 250,
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        onItemClick: null
      };

      /**
       * @class
       */

      var Dropdown = function (_Component2) {
        _inherits(Dropdown, _Component2);

        function Dropdown(el, options) {
          _classCallCheck(this, Dropdown);

          var _this9 = _possibleConstructorReturn(this, (Dropdown.__proto__ || Object.getPrototypeOf(Dropdown)).call(this, Dropdown, el, options));

          _this9.el.M_Dropdown = _this9;
          Dropdown._dropdowns.push(_this9);

          _this9.id = M.getIdFromTrigger(el);
          _this9.dropdownEl = document.getElementById(_this9.id);
          _this9.$dropdownEl = $(_this9.dropdownEl);

          /**
           * Options for the dropdown
           * @member Dropdown#options
           * @prop {String} [alignment='left'] - Edge which the dropdown is aligned to
           * @prop {Boolean} [autoFocus=true] - Automatically focus dropdown el for keyboard
           * @prop {Boolean} [constrainWidth=true] - Constrain width to width of the button
           * @prop {Element} container - Container element to attach dropdown to (optional)
           * @prop {Boolean} [coverTrigger=true] - Place dropdown over trigger
           * @prop {Boolean} [closeOnClick=true] - Close on click of dropdown item
           * @prop {Boolean} [hover=false] - Open dropdown on hover
           * @prop {Number} [inDuration=150] - Duration of open animation in ms
           * @prop {Number} [outDuration=250] - Duration of close animation in ms
           * @prop {Function} onOpenStart - Function called when dropdown starts opening
           * @prop {Function} onOpenEnd - Function called when dropdown finishes opening
           * @prop {Function} onCloseStart - Function called when dropdown starts closing
           * @prop {Function} onCloseEnd - Function called when dropdown finishes closing
           */
          _this9.options = $.extend({}, Dropdown.defaults, options);

          /**
           * Describes open/close state of dropdown
           * @type {Boolean}
           */
          _this9.isOpen = false;

          /**
           * Describes if dropdown content is scrollable
           * @type {Boolean}
           */
          _this9.isScrollable = false;

          /**
           * Describes if touch moving on dropdown content
           * @type {Boolean}
           */
          _this9.isTouchMoving = false;

          _this9.focusedIndex = -1;
          _this9.filterQuery = [];

          // Move dropdown-content after dropdown-trigger
          if (!!_this9.options.container) {
            $(_this9.options.container).append(_this9.dropdownEl);
          } else {
            _this9.$el.after(_this9.dropdownEl);
          }

          _this9._makeDropdownFocusable();
          _this9._resetFilterQueryBound = _this9._resetFilterQuery.bind(_this9);
          _this9._handleDocumentClickBound = _this9._handleDocumentClick.bind(_this9);
          _this9._handleDocumentTouchmoveBound = _this9._handleDocumentTouchmove.bind(_this9);
          _this9._handleDropdownClickBound = _this9._handleDropdownClick.bind(_this9);
          _this9._handleDropdownKeydownBound = _this9._handleDropdownKeydown.bind(_this9);
          _this9._handleTriggerKeydownBound = _this9._handleTriggerKeydown.bind(_this9);
          _this9._setupEventHandlers();
          return _this9;
        }

        _createClass(Dropdown, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._resetDropdownStyles();
            this._removeEventHandlers();
            Dropdown._dropdowns.splice(Dropdown._dropdowns.indexOf(this), 1);
            this.el.M_Dropdown = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            // Trigger keydown handler
            this.el.addEventListener('keydown', this._handleTriggerKeydownBound);

            // Item click handler
            this.dropdownEl.addEventListener('click', this._handleDropdownClickBound);

            // Hover event handlers
            if (this.options.hover) {
              this._handleMouseEnterBound = this._handleMouseEnter.bind(this);
              this.el.addEventListener('mouseenter', this._handleMouseEnterBound);
              this._handleMouseLeaveBound = this._handleMouseLeave.bind(this);
              this.el.addEventListener('mouseleave', this._handleMouseLeaveBound);
              this.dropdownEl.addEventListener('mouseleave', this._handleMouseLeaveBound);

              // Click event handlers
            } else {
              this._handleClickBound = this._handleClick.bind(this);
              this.el.addEventListener('click', this._handleClickBound);
            }
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('keydown', this._handleTriggerKeydownBound);
            this.dropdownEl.removeEventListener('click', this._handleDropdownClickBound);

            if (this.options.hover) {
              this.el.removeEventListener('mouseenter', this._handleMouseEnterBound);
              this.el.removeEventListener('mouseleave', this._handleMouseLeaveBound);
              this.dropdownEl.removeEventListener('mouseleave', this._handleMouseLeaveBound);
            } else {
              this.el.removeEventListener('click', this._handleClickBound);
            }
          }
        }, {
          key: "_setupTemporaryEventHandlers",
          value: function _setupTemporaryEventHandlers() {
            // Use capture phase event handler to prevent click
            document.body.addEventListener('click', this._handleDocumentClickBound, true);
            document.body.addEventListener('touchend', this._handleDocumentClickBound);
            document.body.addEventListener('touchmove', this._handleDocumentTouchmoveBound);
            this.dropdownEl.addEventListener('keydown', this._handleDropdownKeydownBound);
          }
        }, {
          key: "_removeTemporaryEventHandlers",
          value: function _removeTemporaryEventHandlers() {
            // Use capture phase event handler to prevent click
            document.body.removeEventListener('click', this._handleDocumentClickBound, true);
            document.body.removeEventListener('touchend', this._handleDocumentClickBound);
            document.body.removeEventListener('touchmove', this._handleDocumentTouchmoveBound);
            this.dropdownEl.removeEventListener('keydown', this._handleDropdownKeydownBound);
          }
        }, {
          key: "_handleClick",
          value: function _handleClick(e) {
            e.preventDefault();
            this.open();
          }
        }, {
          key: "_handleMouseEnter",
          value: function _handleMouseEnter() {
            this.open();
          }
        }, {
          key: "_handleMouseLeave",
          value: function _handleMouseLeave(e) {
            var toEl = e.toElement || e.relatedTarget;
            var leaveToDropdownContent = !!$(toEl).closest('.dropdown-content').length;
            var leaveToActiveDropdownTrigger = false;

            var $closestTrigger = $(toEl).closest('.dropdown-trigger');
            if ($closestTrigger.length && !!$closestTrigger[0].M_Dropdown && $closestTrigger[0].M_Dropdown.isOpen) {
              leaveToActiveDropdownTrigger = true;
            }

            // Close hover dropdown if mouse did not leave to either active dropdown-trigger or dropdown-content
            if (!leaveToActiveDropdownTrigger && !leaveToDropdownContent) {
              this.close();
            }
          }
        }, {
          key: "_handleDocumentClick",
          value: function _handleDocumentClick(e) {
            var _this10 = this;

            var $target = $(e.target);
            if (this.options.closeOnClick && $target.closest('.dropdown-content').length && !this.isTouchMoving) {
              // isTouchMoving to check if scrolling on mobile.
              setTimeout(function () {
                _this10.close();
              }, 0);
            } else if ($target.closest('.dropdown-trigger').length || !$target.closest('.dropdown-content').length) {
              setTimeout(function () {
                _this10.close();
              }, 0);
            }
            this.isTouchMoving = false;
          }
        }, {
          key: "_handleTriggerKeydown",
          value: function _handleTriggerKeydown(e) {
            // ARROW DOWN OR ENTER WHEN SELECT IS CLOSED - open Dropdown
            if ((e.which === M.keys.ARROW_DOWN || e.which === M.keys.ENTER) && !this.isOpen) {
              e.preventDefault();
              this.open();
            }
          }

          /**
           * Handle Document Touchmove
           * @param {Event} e
           */

        }, {
          key: "_handleDocumentTouchmove",
          value: function _handleDocumentTouchmove(e) {
            var $target = $(e.target);
            if ($target.closest('.dropdown-content').length) {
              this.isTouchMoving = true;
            }
          }

          /**
           * Handle Dropdown Click
           * @param {Event} e
           */

        }, {
          key: "_handleDropdownClick",
          value: function _handleDropdownClick(e) {
            // onItemClick callback
            if (typeof this.options.onItemClick === 'function') {
              var itemEl = $(e.target).closest('li')[0];
              this.options.onItemClick.call(this, itemEl);
            }
          }

          /**
           * Handle Dropdown Keydown
           * @param {Event} e
           */

        }, {
          key: "_handleDropdownKeydown",
          value: function _handleDropdownKeydown(e) {
            if (e.which === M.keys.TAB) {
              e.preventDefault();
              this.close();

              // Navigate down dropdown list
            } else if ((e.which === M.keys.ARROW_DOWN || e.which === M.keys.ARROW_UP) && this.isOpen) {
              e.preventDefault();
              var direction = e.which === M.keys.ARROW_DOWN ? 1 : -1;
              var newFocusedIndex = this.focusedIndex;
              var foundNewIndex = false;
              do {
                newFocusedIndex = newFocusedIndex + direction;

                if (!!this.dropdownEl.children[newFocusedIndex] && this.dropdownEl.children[newFocusedIndex].tabIndex !== -1) {
                  foundNewIndex = true;
                  break;
                }
              } while (newFocusedIndex < this.dropdownEl.children.length && newFocusedIndex >= 0);

              if (foundNewIndex) {
                this.focusedIndex = newFocusedIndex;
                this._focusFocusedItem();
              }

              // ENTER selects choice on focused item
            } else if (e.which === M.keys.ENTER && this.isOpen) {
              // Search for <a> and <button>
              var focusedElement = this.dropdownEl.children[this.focusedIndex];
              var $activatableElement = $(focusedElement).find('a, button').first();

              // Click a or button tag if exists, otherwise click li tag
              if (!!$activatableElement.length) {
                $activatableElement[0].click();
              } else if (!!focusedElement) {
                focusedElement.click();
              }

              // Close dropdown on ESC
            } else if (e.which === M.keys.ESC && this.isOpen) {
              e.preventDefault();
              this.close();
            }

            // CASE WHEN USER TYPE LETTERS
            var letter = String.fromCharCode(e.which).toLowerCase(),
                nonLetters = [9, 13, 27, 38, 40];
            if (letter && nonLetters.indexOf(e.which) === -1) {
              this.filterQuery.push(letter);

              var string = this.filterQuery.join(''),
                  newOptionEl = $(this.dropdownEl).find('li').filter(function (el) {
                return $(el).text().toLowerCase().indexOf(string) === 0;
              })[0];

              if (newOptionEl) {
                this.focusedIndex = $(newOptionEl).index();
                this._focusFocusedItem();
              }
            }

            this.filterTimeout = setTimeout(this._resetFilterQueryBound, 1000);
          }

          /**
           * Setup dropdown
           */

        }, {
          key: "_resetFilterQuery",
          value: function _resetFilterQuery() {
            this.filterQuery = [];
          }
        }, {
          key: "_resetDropdownStyles",
          value: function _resetDropdownStyles() {
            this.$dropdownEl.css({
              display: '',
              width: '',
              height: '',
              left: '',
              top: '',
              'transform-origin': '',
              transform: '',
              opacity: ''
            });
          }
        }, {
          key: "_makeDropdownFocusable",
          value: function _makeDropdownFocusable() {
            // Needed for arrow key navigation
            this.dropdownEl.tabIndex = 0;

            // Only set tabindex if it hasn't been set by user
            $(this.dropdownEl).children().each(function (el) {
              if (!el.getAttribute('tabindex')) {
                el.setAttribute('tabindex', 0);
              }
            });
          }
        }, {
          key: "_focusFocusedItem",
          value: function _focusFocusedItem() {
            if (this.focusedIndex >= 0 && this.focusedIndex < this.dropdownEl.children.length && this.options.autoFocus) {
              this.dropdownEl.children[this.focusedIndex].focus();
            }
          }
        }, {
          key: "_getDropdownPosition",
          value: function _getDropdownPosition() {
            var offsetParentBRect = this.el.offsetParent.getBoundingClientRect();
            var triggerBRect = this.el.getBoundingClientRect();
            var dropdownBRect = this.dropdownEl.getBoundingClientRect();

            var idealHeight = dropdownBRect.height;
            var idealWidth = dropdownBRect.width;
            var idealXPos = triggerBRect.left - dropdownBRect.left;
            var idealYPos = triggerBRect.top - dropdownBRect.top;

            var dropdownBounds = {
              left: idealXPos,
              top: idealYPos,
              height: idealHeight,
              width: idealWidth
            };

            // Countainer here will be closest ancestor with overflow: hidden
            var closestOverflowParent = !!this.dropdownEl.offsetParent ? this.dropdownEl.offsetParent : this.dropdownEl.parentNode;

            var alignments = M.checkPossibleAlignments(this.el, closestOverflowParent, dropdownBounds, this.options.coverTrigger ? 0 : triggerBRect.height);

            var verticalAlignment = 'top';
            var horizontalAlignment = this.options.alignment;
            idealYPos += this.options.coverTrigger ? 0 : triggerBRect.height;

            // Reset isScrollable
            this.isScrollable = false;

            if (!alignments.top) {
              if (alignments.bottom) {
                verticalAlignment = 'bottom';
              } else {
                this.isScrollable = true;

                // Determine which side has most space and cutoff at correct height
                if (alignments.spaceOnTop > alignments.spaceOnBottom) {
                  verticalAlignment = 'bottom';
                  idealHeight += alignments.spaceOnTop;
                  idealYPos -= alignments.spaceOnTop;
                } else {
                  idealHeight += alignments.spaceOnBottom;
                }
              }
            }

            // If preferred horizontal alignment is possible
            if (!alignments[horizontalAlignment]) {
              var oppositeAlignment = horizontalAlignment === 'left' ? 'right' : 'left';
              if (alignments[oppositeAlignment]) {
                horizontalAlignment = oppositeAlignment;
              } else {
                // Determine which side has most space and cutoff at correct height
                if (alignments.spaceOnLeft > alignments.spaceOnRight) {
                  horizontalAlignment = 'right';
                  idealWidth += alignments.spaceOnLeft;
                  idealXPos -= alignments.spaceOnLeft;
                } else {
                  horizontalAlignment = 'left';
                  idealWidth += alignments.spaceOnRight;
                }
              }
            }

            if (verticalAlignment === 'bottom') {
              idealYPos = idealYPos - dropdownBRect.height + (this.options.coverTrigger ? triggerBRect.height : 0);
            }
            if (horizontalAlignment === 'right') {
              idealXPos = idealXPos - dropdownBRect.width + triggerBRect.width;
            }
            return {
              x: idealXPos,
              y: idealYPos,
              verticalAlignment: verticalAlignment,
              horizontalAlignment: horizontalAlignment,
              height: idealHeight,
              width: idealWidth
            };
          }

          /**
           * Animate in dropdown
           */

        }, {
          key: "_animateIn",
          value: function _animateIn() {
            var _this11 = this;

            anim.remove(this.dropdownEl);
            anim({
              targets: this.dropdownEl,
              opacity: {
                value: [0, 1],
                easing: 'easeOutQuad'
              },
              scaleX: [0.3, 1],
              scaleY: [0.3, 1],
              duration: this.options.inDuration,
              easing: 'easeOutQuint',
              complete: function (anim) {
                if (_this11.options.autoFocus) {
                  _this11.dropdownEl.focus();
                }

                // onOpenEnd callback
                if (typeof _this11.options.onOpenEnd === 'function') {
                  _this11.options.onOpenEnd.call(_this11, _this11.el);
                }
              }
            });
          }

          /**
           * Animate out dropdown
           */

        }, {
          key: "_animateOut",
          value: function _animateOut() {
            var _this12 = this;

            anim.remove(this.dropdownEl);
            anim({
              targets: this.dropdownEl,
              opacity: {
                value: 0,
                easing: 'easeOutQuint'
              },
              scaleX: 0.3,
              scaleY: 0.3,
              duration: this.options.outDuration,
              easing: 'easeOutQuint',
              complete: function (anim) {
                _this12._resetDropdownStyles();

                // onCloseEnd callback
                if (typeof _this12.options.onCloseEnd === 'function') {
                  _this12.options.onCloseEnd.call(_this12, _this12.el);
                }
              }
            });
          }

          /**
           * Place dropdown
           */

        }, {
          key: "_placeDropdown",
          value: function _placeDropdown() {
            // Set width before calculating positionInfo
            var idealWidth = this.options.constrainWidth ? this.el.getBoundingClientRect().width : this.dropdownEl.getBoundingClientRect().width;
            this.dropdownEl.style.width = idealWidth + 'px';

            var positionInfo = this._getDropdownPosition();
            this.dropdownEl.style.left = positionInfo.x + 'px';
            this.dropdownEl.style.top = positionInfo.y + 'px';
            this.dropdownEl.style.height = positionInfo.height + 'px';
            this.dropdownEl.style.width = positionInfo.width + 'px';
            this.dropdownEl.style.transformOrigin = (positionInfo.horizontalAlignment === 'left' ? '0' : '100%') + " " + (positionInfo.verticalAlignment === 'top' ? '0' : '100%');
          }

          /**
           * Open Dropdown
           */

        }, {
          key: "open",
          value: function open() {
            if (this.isOpen) {
              return;
            }
            this.isOpen = true;

            // onOpenStart callback
            if (typeof this.options.onOpenStart === 'function') {
              this.options.onOpenStart.call(this, this.el);
            }

            // Reset styles
            this._resetDropdownStyles();
            this.dropdownEl.style.display = 'block';

            this._placeDropdown();
            this._animateIn();
            this._setupTemporaryEventHandlers();
          }

          /**
           * Close Dropdown
           */

        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }
            this.isOpen = false;
            this.focusedIndex = -1;

            // onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
              this.options.onCloseStart.call(this, this.el);
            }

            this._animateOut();
            this._removeTemporaryEventHandlers();

            if (this.options.autoFocus) {
              this.el.focus();
            }
          }

          /**
           * Recalculate dimensions
           */

        }, {
          key: "recalculateDimensions",
          value: function recalculateDimensions() {
            if (this.isOpen) {
              this.$dropdownEl.css({
                width: '',
                height: '',
                left: '',
                top: '',
                'transform-origin': ''
              });
              this._placeDropdown();
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Dropdown.__proto__ || Object.getPrototypeOf(Dropdown), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Dropdown;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Dropdown;
      }(Component);

      /**
       * @static
       * @memberof Dropdown
       */


      Dropdown._dropdowns = [];

      M.Dropdown = Dropdown;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Dropdown, 'dropdown', 'M_Dropdown');
      }
    })(cash, M.anime);
    (function ($, anim) {

      var _defaults = {
        opacity: 0.5,
        inDuration: 250,
        outDuration: 250,
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        preventScrolling: true,
        dismissible: true,
        startingTop: '4%',
        endingTop: '10%'
      };

      /**
       * @class
       *
       */

      var Modal = function (_Component3) {
        _inherits(Modal, _Component3);

        /**
         * Construct Modal instance and set up overlay
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Modal(el, options) {
          _classCallCheck(this, Modal);

          var _this13 = _possibleConstructorReturn(this, (Modal.__proto__ || Object.getPrototypeOf(Modal)).call(this, Modal, el, options));

          _this13.el.M_Modal = _this13;

          /**
           * Options for the modal
           * @member Modal#options
           * @prop {Number} [opacity=0.5] - Opacity of the modal overlay
           * @prop {Number} [inDuration=250] - Length in ms of enter transition
           * @prop {Number} [outDuration=250] - Length in ms of exit transition
           * @prop {Function} onOpenStart - Callback function called before modal is opened
           * @prop {Function} onOpenEnd - Callback function called after modal is opened
           * @prop {Function} onCloseStart - Callback function called before modal is closed
           * @prop {Function} onCloseEnd - Callback function called after modal is closed
           * @prop {Boolean} [dismissible=true] - Allow modal to be dismissed by keyboard or overlay click
           * @prop {String} [startingTop='4%'] - startingTop
           * @prop {String} [endingTop='10%'] - endingTop
           */
          _this13.options = $.extend({}, Modal.defaults, options);

          /**
           * Describes open/close state of modal
           * @type {Boolean}
           */
          _this13.isOpen = false;

          _this13.id = _this13.$el.attr('id');
          _this13._openingTrigger = undefined;
          _this13.$overlay = $('<div class="modal-overlay"></div>');
          _this13.el.tabIndex = 0;
          _this13._nthModalOpened = 0;

          Modal._count++;
          _this13._setupEventHandlers();
          return _this13;
        }

        _createClass(Modal, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            Modal._count--;
            this._removeEventHandlers();
            this.el.removeAttribute('style');
            this.$overlay.remove();
            this.el.M_Modal = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleOverlayClickBound = this._handleOverlayClick.bind(this);
            this._handleModalCloseClickBound = this._handleModalCloseClick.bind(this);

            if (Modal._count === 1) {
              document.body.addEventListener('click', this._handleTriggerClick);
            }
            this.$overlay[0].addEventListener('click', this._handleOverlayClickBound);
            this.el.addEventListener('click', this._handleModalCloseClickBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            if (Modal._count === 0) {
              document.body.removeEventListener('click', this._handleTriggerClick);
            }
            this.$overlay[0].removeEventListener('click', this._handleOverlayClickBound);
            this.el.removeEventListener('click', this._handleModalCloseClickBound);
          }

          /**
           * Handle Trigger Click
           * @param {Event} e
           */

        }, {
          key: "_handleTriggerClick",
          value: function _handleTriggerClick(e) {
            var $trigger = $(e.target).closest('.modal-trigger');
            if ($trigger.length) {
              var modalId = M.getIdFromTrigger($trigger[0]);
              var modalInstance = document.getElementById(modalId).M_Modal;
              if (modalInstance) {
                modalInstance.open($trigger);
              }
              e.preventDefault();
            }
          }

          /**
           * Handle Overlay Click
           */

        }, {
          key: "_handleOverlayClick",
          value: function _handleOverlayClick() {
            if (this.options.dismissible) {
              this.close();
            }
          }

          /**
           * Handle Modal Close Click
           * @param {Event} e
           */

        }, {
          key: "_handleModalCloseClick",
          value: function _handleModalCloseClick(e) {
            var $closeTrigger = $(e.target).closest('.modal-close');
            if ($closeTrigger.length) {
              this.close();
            }
          }

          /**
           * Handle Keydown
           * @param {Event} e
           */

        }, {
          key: "_handleKeydown",
          value: function _handleKeydown(e) {
            // ESC key
            if (e.keyCode === 27 && this.options.dismissible) {
              this.close();
            }
          }

          /**
           * Handle Focus
           * @param {Event} e
           */

        }, {
          key: "_handleFocus",
          value: function _handleFocus(e) {
            // Only trap focus if this modal is the last model opened (prevents loops in nested modals).
            if (!this.el.contains(e.target) && this._nthModalOpened === Modal._modalsOpen) {
              this.el.focus();
            }
          }

          /**
           * Animate in modal
           */

        }, {
          key: "_animateIn",
          value: function _animateIn() {
            var _this14 = this;

            // Set initial styles
            $.extend(this.el.style, {
              display: 'block',
              opacity: 0
            });
            $.extend(this.$overlay[0].style, {
              display: 'block',
              opacity: 0
            });

            // Animate overlay
            anim({
              targets: this.$overlay[0],
              opacity: this.options.opacity,
              duration: this.options.inDuration,
              easing: 'easeOutQuad'
            });

            // Define modal animation options
            var enterAnimOptions = {
              targets: this.el,
              duration: this.options.inDuration,
              easing: 'easeOutCubic',
              // Handle modal onOpenEnd callback
              complete: function () {
                if (typeof _this14.options.onOpenEnd === 'function') {
                  _this14.options.onOpenEnd.call(_this14, _this14.el, _this14._openingTrigger);
                }
              }
            };

            // Bottom sheet animation
            if (this.el.classList.contains('bottom-sheet')) {
              $.extend(enterAnimOptions, {
                bottom: 0,
                opacity: 1
              });
              anim(enterAnimOptions);

              // Normal modal animation
            } else {
              $.extend(enterAnimOptions, {
                top: [this.options.startingTop, this.options.endingTop],
                opacity: 1,
                scaleX: [0.8, 1],
                scaleY: [0.8, 1]
              });
              anim(enterAnimOptions);
            }
          }

          /**
           * Animate out modal
           */

        }, {
          key: "_animateOut",
          value: function _animateOut() {
            var _this15 = this;

            // Animate overlay
            anim({
              targets: this.$overlay[0],
              opacity: 0,
              duration: this.options.outDuration,
              easing: 'easeOutQuart'
            });

            // Define modal animation options
            var exitAnimOptions = {
              targets: this.el,
              duration: this.options.outDuration,
              easing: 'easeOutCubic',
              // Handle modal ready callback
              complete: function () {
                _this15.el.style.display = 'none';
                _this15.$overlay.remove();

                // Call onCloseEnd callback
                if (typeof _this15.options.onCloseEnd === 'function') {
                  _this15.options.onCloseEnd.call(_this15, _this15.el);
                }
              }
            };

            // Bottom sheet animation
            if (this.el.classList.contains('bottom-sheet')) {
              $.extend(exitAnimOptions, {
                bottom: '-100%',
                opacity: 0
              });
              anim(exitAnimOptions);

              // Normal modal animation
            } else {
              $.extend(exitAnimOptions, {
                top: [this.options.endingTop, this.options.startingTop],
                opacity: 0,
                scaleX: 0.8,
                scaleY: 0.8
              });
              anim(exitAnimOptions);
            }
          }

          /**
           * Open Modal
           * @param {cash} [$trigger]
           */

        }, {
          key: "open",
          value: function open($trigger) {
            if (this.isOpen) {
              return;
            }

            this.isOpen = true;
            Modal._modalsOpen++;
            this._nthModalOpened = Modal._modalsOpen;

            // Set Z-Index based on number of currently open modals
            this.$overlay[0].style.zIndex = 1000 + Modal._modalsOpen * 2;
            this.el.style.zIndex = 1000 + Modal._modalsOpen * 2 + 1;

            // Set opening trigger, undefined indicates modal was opened by javascript
            this._openingTrigger = !!$trigger ? $trigger[0] : undefined;

            // onOpenStart callback
            if (typeof this.options.onOpenStart === 'function') {
              this.options.onOpenStart.call(this, this.el, this._openingTrigger);
            }

            if (this.options.preventScrolling) {
              document.body.style.overflow = 'hidden';
            }

            this.el.classList.add('open');
            this.el.insertAdjacentElement('afterend', this.$overlay[0]);

            if (this.options.dismissible) {
              this._handleKeydownBound = this._handleKeydown.bind(this);
              this._handleFocusBound = this._handleFocus.bind(this);
              document.addEventListener('keydown', this._handleKeydownBound);
              document.addEventListener('focus', this._handleFocusBound, true);
            }

            anim.remove(this.el);
            anim.remove(this.$overlay[0]);
            this._animateIn();

            // Focus modal
            this.el.focus();

            return this;
          }

          /**
           * Close Modal
           */

        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }

            this.isOpen = false;
            Modal._modalsOpen--;
            this._nthModalOpened = 0;

            // Call onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
              this.options.onCloseStart.call(this, this.el);
            }

            this.el.classList.remove('open');

            // Enable body scrolling only if there are no more modals open.
            if (Modal._modalsOpen === 0) {
              document.body.style.overflow = '';
            }

            if (this.options.dismissible) {
              document.removeEventListener('keydown', this._handleKeydownBound);
              document.removeEventListener('focus', this._handleFocusBound, true);
            }

            anim.remove(this.el);
            anim.remove(this.$overlay[0]);
            this._animateOut();
            return this;
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Modal.__proto__ || Object.getPrototypeOf(Modal), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Modal;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Modal;
      }(Component);

      /**
       * @static
       * @memberof Modal
       */


      Modal._modalsOpen = 0;

      /**
       * @static
       * @memberof Modal
       */
      Modal._count = 0;

      M.Modal = Modal;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Modal, 'modal', 'M_Modal');
      }
    })(cash, M.anime);
    (function ($, anim) {

      var _defaults = {
        inDuration: 275,
        outDuration: 200,
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null
      };

      /**
       * @class
       *
       */

      var Materialbox = function (_Component4) {
        _inherits(Materialbox, _Component4);

        /**
         * Construct Materialbox instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Materialbox(el, options) {
          _classCallCheck(this, Materialbox);

          var _this16 = _possibleConstructorReturn(this, (Materialbox.__proto__ || Object.getPrototypeOf(Materialbox)).call(this, Materialbox, el, options));

          _this16.el.M_Materialbox = _this16;

          /**
           * Options for the modal
           * @member Materialbox#options
           * @prop {Number} [inDuration=275] - Length in ms of enter transition
           * @prop {Number} [outDuration=200] - Length in ms of exit transition
           * @prop {Function} onOpenStart - Callback function called before materialbox is opened
           * @prop {Function} onOpenEnd - Callback function called after materialbox is opened
           * @prop {Function} onCloseStart - Callback function called before materialbox is closed
           * @prop {Function} onCloseEnd - Callback function called after materialbox is closed
           */
          _this16.options = $.extend({}, Materialbox.defaults, options);

          _this16.overlayActive = false;
          _this16.doneAnimating = true;
          _this16.placeholder = $('<div></div>').addClass('material-placeholder');
          _this16.originalWidth = 0;
          _this16.originalHeight = 0;
          _this16.originInlineStyles = _this16.$el.attr('style');
          _this16.caption = _this16.el.getAttribute('data-caption') || '';

          // Wrap
          _this16.$el.before(_this16.placeholder);
          _this16.placeholder.append(_this16.$el);

          _this16._setupEventHandlers();
          return _this16;
        }

        _createClass(Materialbox, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.el.M_Materialbox = undefined;

            // Unwrap image
            $(this.placeholder).after(this.el).remove();

            this.$el.removeAttr('style');
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleMaterialboxClickBound = this._handleMaterialboxClick.bind(this);
            this.el.addEventListener('click', this._handleMaterialboxClickBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('click', this._handleMaterialboxClickBound);
          }

          /**
           * Handle Materialbox Click
           * @param {Event} e
           */

        }, {
          key: "_handleMaterialboxClick",
          value: function _handleMaterialboxClick(e) {
            // If already modal, return to original
            if (this.doneAnimating === false || this.overlayActive && this.doneAnimating) {
              this.close();
            } else {
              this.open();
            }
          }

          /**
           * Handle Window Scroll
           */

        }, {
          key: "_handleWindowScroll",
          value: function _handleWindowScroll() {
            if (this.overlayActive) {
              this.close();
            }
          }

          /**
           * Handle Window Resize
           */

        }, {
          key: "_handleWindowResize",
          value: function _handleWindowResize() {
            if (this.overlayActive) {
              this.close();
            }
          }

          /**
           * Handle Window Resize
           * @param {Event} e
           */

        }, {
          key: "_handleWindowEscape",
          value: function _handleWindowEscape(e) {
            // ESC key
            if (e.keyCode === 27 && this.doneAnimating && this.overlayActive) {
              this.close();
            }
          }

          /**
           * Find ancestors with overflow: hidden; and make visible
           */

        }, {
          key: "_makeAncestorsOverflowVisible",
          value: function _makeAncestorsOverflowVisible() {
            this.ancestorsChanged = $();
            var ancestor = this.placeholder[0].parentNode;
            while (ancestor !== null && !$(ancestor).is(document)) {
              var curr = $(ancestor);
              if (curr.css('overflow') !== 'visible') {
                curr.css('overflow', 'visible');
                if (this.ancestorsChanged === undefined) {
                  this.ancestorsChanged = curr;
                } else {
                  this.ancestorsChanged = this.ancestorsChanged.add(curr);
                }
              }
              ancestor = ancestor.parentNode;
            }
          }

          /**
           * Animate image in
           */

        }, {
          key: "_animateImageIn",
          value: function _animateImageIn() {
            var _this17 = this;

            var animOptions = {
              targets: this.el,
              height: [this.originalHeight, this.newHeight],
              width: [this.originalWidth, this.newWidth],
              left: M.getDocumentScrollLeft() + this.windowWidth / 2 - this.placeholder.offset().left - this.newWidth / 2,
              top: M.getDocumentScrollTop() + this.windowHeight / 2 - this.placeholder.offset().top - this.newHeight / 2,
              duration: this.options.inDuration,
              easing: 'easeOutQuad',
              complete: function () {
                _this17.doneAnimating = true;

                // onOpenEnd callback
                if (typeof _this17.options.onOpenEnd === 'function') {
                  _this17.options.onOpenEnd.call(_this17, _this17.el);
                }
              }
            };

            // Override max-width or max-height if needed
            this.maxWidth = this.$el.css('max-width');
            this.maxHeight = this.$el.css('max-height');
            if (this.maxWidth !== 'none') {
              animOptions.maxWidth = this.newWidth;
            }
            if (this.maxHeight !== 'none') {
              animOptions.maxHeight = this.newHeight;
            }

            anim(animOptions);
          }

          /**
           * Animate image out
           */

        }, {
          key: "_animateImageOut",
          value: function _animateImageOut() {
            var _this18 = this;

            var animOptions = {
              targets: this.el,
              width: this.originalWidth,
              height: this.originalHeight,
              left: 0,
              top: 0,
              duration: this.options.outDuration,
              easing: 'easeOutQuad',
              complete: function () {
                _this18.placeholder.css({
                  height: '',
                  width: '',
                  position: '',
                  top: '',
                  left: ''
                });

                // Revert to width or height attribute
                if (_this18.attrWidth) {
                  _this18.$el.attr('width', _this18.attrWidth);
                }
                if (_this18.attrHeight) {
                  _this18.$el.attr('height', _this18.attrHeight);
                }

                _this18.$el.removeAttr('style');
                _this18.originInlineStyles && _this18.$el.attr('style', _this18.originInlineStyles);

                // Remove class
                _this18.$el.removeClass('active');
                _this18.doneAnimating = true;

                // Remove overflow overrides on ancestors
                if (_this18.ancestorsChanged.length) {
                  _this18.ancestorsChanged.css('overflow', '');
                }

                // onCloseEnd callback
                if (typeof _this18.options.onCloseEnd === 'function') {
                  _this18.options.onCloseEnd.call(_this18, _this18.el);
                }
              }
            };

            anim(animOptions);
          }

          /**
           * Update open and close vars
           */

        }, {
          key: "_updateVars",
          value: function _updateVars() {
            this.windowWidth = window.innerWidth;
            this.windowHeight = window.innerHeight;
            this.caption = this.el.getAttribute('data-caption') || '';
          }

          /**
           * Open Materialbox
           */

        }, {
          key: "open",
          value: function open() {
            var _this19 = this;

            this._updateVars();
            this.originalWidth = this.el.getBoundingClientRect().width;
            this.originalHeight = this.el.getBoundingClientRect().height;

            // Set states
            this.doneAnimating = false;
            this.$el.addClass('active');
            this.overlayActive = true;

            // onOpenStart callback
            if (typeof this.options.onOpenStart === 'function') {
              this.options.onOpenStart.call(this, this.el);
            }

            // Set positioning for placeholder
            this.placeholder.css({
              width: this.placeholder[0].getBoundingClientRect().width + 'px',
              height: this.placeholder[0].getBoundingClientRect().height + 'px',
              position: 'relative',
              top: 0,
              left: 0
            });

            this._makeAncestorsOverflowVisible();

            // Set css on origin
            this.$el.css({
              position: 'absolute',
              'z-index': 1000,
              'will-change': 'left, top, width, height'
            });

            // Change from width or height attribute to css
            this.attrWidth = this.$el.attr('width');
            this.attrHeight = this.$el.attr('height');
            if (this.attrWidth) {
              this.$el.css('width', this.attrWidth + 'px');
              this.$el.removeAttr('width');
            }
            if (this.attrHeight) {
              this.$el.css('width', this.attrHeight + 'px');
              this.$el.removeAttr('height');
            }

            // Add overlay
            this.$overlay = $('<div id="materialbox-overlay"></div>').css({
              opacity: 0
            }).one('click', function () {
              if (_this19.doneAnimating) {
                _this19.close();
              }
            });

            // Put before in origin image to preserve z-index layering.
            this.$el.before(this.$overlay);

            // Set dimensions if needed
            var overlayOffset = this.$overlay[0].getBoundingClientRect();
            this.$overlay.css({
              width: this.windowWidth + 'px',
              height: this.windowHeight + 'px',
              left: -1 * overlayOffset.left + 'px',
              top: -1 * overlayOffset.top + 'px'
            });

            anim.remove(this.el);
            anim.remove(this.$overlay[0]);

            // Animate Overlay
            anim({
              targets: this.$overlay[0],
              opacity: 1,
              duration: this.options.inDuration,
              easing: 'easeOutQuad'
            });

            // Add and animate caption if it exists
            if (this.caption !== '') {
              if (this.$photocaption) {
                anim.remove(this.$photoCaption[0]);
              }
              this.$photoCaption = $('<div class="materialbox-caption"></div>');
              this.$photoCaption.text(this.caption);
              $('body').append(this.$photoCaption);
              this.$photoCaption.css({ display: 'inline' });

              anim({
                targets: this.$photoCaption[0],
                opacity: 1,
                duration: this.options.inDuration,
                easing: 'easeOutQuad'
              });
            }

            // Resize Image
            var ratio = 0;
            var widthPercent = this.originalWidth / this.windowWidth;
            var heightPercent = this.originalHeight / this.windowHeight;
            this.newWidth = 0;
            this.newHeight = 0;

            if (widthPercent > heightPercent) {
              ratio = this.originalHeight / this.originalWidth;
              this.newWidth = this.windowWidth * 0.9;
              this.newHeight = this.windowWidth * 0.9 * ratio;
            } else {
              ratio = this.originalWidth / this.originalHeight;
              this.newWidth = this.windowHeight * 0.9 * ratio;
              this.newHeight = this.windowHeight * 0.9;
            }

            this._animateImageIn();

            // Handle Exit triggers
            this._handleWindowScrollBound = this._handleWindowScroll.bind(this);
            this._handleWindowResizeBound = this._handleWindowResize.bind(this);
            this._handleWindowEscapeBound = this._handleWindowEscape.bind(this);

            window.addEventListener('scroll', this._handleWindowScrollBound);
            window.addEventListener('resize', this._handleWindowResizeBound);
            window.addEventListener('keyup', this._handleWindowEscapeBound);
          }

          /**
           * Close Materialbox
           */

        }, {
          key: "close",
          value: function close() {
            var _this20 = this;

            this._updateVars();
            this.doneAnimating = false;

            // onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
              this.options.onCloseStart.call(this, this.el);
            }

            anim.remove(this.el);
            anim.remove(this.$overlay[0]);

            if (this.caption !== '') {
              anim.remove(this.$photoCaption[0]);
            }

            // disable exit handlers
            window.removeEventListener('scroll', this._handleWindowScrollBound);
            window.removeEventListener('resize', this._handleWindowResizeBound);
            window.removeEventListener('keyup', this._handleWindowEscapeBound);

            anim({
              targets: this.$overlay[0],
              opacity: 0,
              duration: this.options.outDuration,
              easing: 'easeOutQuad',
              complete: function () {
                _this20.overlayActive = false;
                _this20.$overlay.remove();
              }
            });

            this._animateImageOut();

            // Remove Caption + reset css settings on image
            if (this.caption !== '') {
              anim({
                targets: this.$photoCaption[0],
                opacity: 0,
                duration: this.options.outDuration,
                easing: 'easeOutQuad',
                complete: function () {
                  _this20.$photoCaption.remove();
                }
              });
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Materialbox.__proto__ || Object.getPrototypeOf(Materialbox), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Materialbox;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Materialbox;
      }(Component);

      M.Materialbox = Materialbox;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Materialbox, 'materialbox', 'M_Materialbox');
      }
    })(cash, M.anime);
    (function ($) {

      var _defaults = {
        responsiveThreshold: 0 // breakpoint for swipeable
      };

      var Parallax = function (_Component5) {
        _inherits(Parallax, _Component5);

        function Parallax(el, options) {
          _classCallCheck(this, Parallax);

          var _this21 = _possibleConstructorReturn(this, (Parallax.__proto__ || Object.getPrototypeOf(Parallax)).call(this, Parallax, el, options));

          _this21.el.M_Parallax = _this21;

          /**
           * Options for the Parallax
           * @member Parallax#options
           * @prop {Number} responsiveThreshold
           */
          _this21.options = $.extend({}, Parallax.defaults, options);
          _this21._enabled = window.innerWidth > _this21.options.responsiveThreshold;

          _this21.$img = _this21.$el.find('img').first();
          _this21.$img.each(function () {
            var el = this;
            if (el.complete) $(el).trigger('load');
          });

          _this21._updateParallax();
          _this21._setupEventHandlers();
          _this21._setupStyles();

          Parallax._parallaxes.push(_this21);
          return _this21;
        }

        _createClass(Parallax, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            Parallax._parallaxes.splice(Parallax._parallaxes.indexOf(this), 1);
            this.$img[0].style.transform = '';
            this._removeEventHandlers();

            this.$el[0].M_Parallax = undefined;
          }
        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleImageLoadBound = this._handleImageLoad.bind(this);
            this.$img[0].addEventListener('load', this._handleImageLoadBound);

            if (Parallax._parallaxes.length === 0) {
              Parallax._handleScrollThrottled = M.throttle(Parallax._handleScroll, 5);
              window.addEventListener('scroll', Parallax._handleScrollThrottled);

              Parallax._handleWindowResizeThrottled = M.throttle(Parallax._handleWindowResize, 5);
              window.addEventListener('resize', Parallax._handleWindowResizeThrottled);
            }
          }
        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.$img[0].removeEventListener('load', this._handleImageLoadBound);

            if (Parallax._parallaxes.length === 0) {
              window.removeEventListener('scroll', Parallax._handleScrollThrottled);
              window.removeEventListener('resize', Parallax._handleWindowResizeThrottled);
            }
          }
        }, {
          key: "_setupStyles",
          value: function _setupStyles() {
            this.$img[0].style.opacity = 1;
          }
        }, {
          key: "_handleImageLoad",
          value: function _handleImageLoad() {
            this._updateParallax();
          }
        }, {
          key: "_updateParallax",
          value: function _updateParallax() {
            var containerHeight = this.$el.height() > 0 ? this.el.parentNode.offsetHeight : 500;
            var imgHeight = this.$img[0].offsetHeight;
            var parallaxDist = imgHeight - containerHeight;
            var bottom = this.$el.offset().top + containerHeight;
            var top = this.$el.offset().top;
            var scrollTop = M.getDocumentScrollTop();
            var windowHeight = window.innerHeight;
            var windowBottom = scrollTop + windowHeight;
            var percentScrolled = (windowBottom - top) / (containerHeight + windowHeight);
            var parallax = parallaxDist * percentScrolled;

            if (!this._enabled) {
              this.$img[0].style.transform = '';
            } else if (bottom > scrollTop && top < scrollTop + windowHeight) {
              this.$img[0].style.transform = "translate3D(-50%, " + parallax + "px, 0)";
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Parallax.__proto__ || Object.getPrototypeOf(Parallax), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Parallax;
          }
        }, {
          key: "_handleScroll",
          value: function _handleScroll() {
            for (var i = 0; i < Parallax._parallaxes.length; i++) {
              var parallaxInstance = Parallax._parallaxes[i];
              parallaxInstance._updateParallax.call(parallaxInstance);
            }
          }
        }, {
          key: "_handleWindowResize",
          value: function _handleWindowResize() {
            for (var i = 0; i < Parallax._parallaxes.length; i++) {
              var parallaxInstance = Parallax._parallaxes[i];
              parallaxInstance._enabled = window.innerWidth > parallaxInstance.options.responsiveThreshold;
            }
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Parallax;
      }(Component);

      /**
       * @static
       * @memberof Parallax
       */


      Parallax._parallaxes = [];

      M.Parallax = Parallax;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Parallax, 'parallax', 'M_Parallax');
      }
    })(cash);
    (function ($, anim) {

      var _defaults = {
        duration: 300,
        onShow: null,
        swipeable: false,
        responsiveThreshold: Infinity // breakpoint for swipeable
      };

      /**
       * @class
       *
       */

      var Tabs = function (_Component6) {
        _inherits(Tabs, _Component6);

        /**
         * Construct Tabs instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Tabs(el, options) {
          _classCallCheck(this, Tabs);

          var _this22 = _possibleConstructorReturn(this, (Tabs.__proto__ || Object.getPrototypeOf(Tabs)).call(this, Tabs, el, options));

          _this22.el.M_Tabs = _this22;

          /**
           * Options for the Tabs
           * @member Tabs#options
           * @prop {Number} duration
           * @prop {Function} onShow
           * @prop {Boolean} swipeable
           * @prop {Number} responsiveThreshold
           */
          _this22.options = $.extend({}, Tabs.defaults, options);

          // Setup
          _this22.$tabLinks = _this22.$el.children('li.tab').children('a');
          _this22.index = 0;
          _this22._setupActiveTabLink();

          // Setup tabs content
          if (_this22.options.swipeable) {
            _this22._setupSwipeableTabs();
          } else {
            _this22._setupNormalTabs();
          }

          // Setup tabs indicator after content to ensure accurate widths
          _this22._setTabsAndTabWidth();
          _this22._createIndicator();

          _this22._setupEventHandlers();
          return _this22;
        }

        _createClass(Tabs, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this._indicator.parentNode.removeChild(this._indicator);

            if (this.options.swipeable) {
              this._teardownSwipeableTabs();
            } else {
              this._teardownNormalTabs();
            }

            this.$el[0].M_Tabs = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleWindowResizeBound = this._handleWindowResize.bind(this);
            window.addEventListener('resize', this._handleWindowResizeBound);

            this._handleTabClickBound = this._handleTabClick.bind(this);
            this.el.addEventListener('click', this._handleTabClickBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            window.removeEventListener('resize', this._handleWindowResizeBound);
            this.el.removeEventListener('click', this._handleTabClickBound);
          }

          /**
           * Handle window Resize
           */

        }, {
          key: "_handleWindowResize",
          value: function _handleWindowResize() {
            this._setTabsAndTabWidth();

            if (this.tabWidth !== 0 && this.tabsWidth !== 0) {
              this._indicator.style.left = this._calcLeftPos(this.$activeTabLink) + 'px';
              this._indicator.style.right = this._calcRightPos(this.$activeTabLink) + 'px';
            }
          }

          /**
           * Handle tab click
           * @param {Event} e
           */

        }, {
          key: "_handleTabClick",
          value: function _handleTabClick(e) {
            var _this23 = this;

            var tab = $(e.target).closest('li.tab');
            var tabLink = $(e.target).closest('a');

            // Handle click on tab link only
            if (!tabLink.length || !tabLink.parent().hasClass('tab')) {
              return;
            }

            if (tab.hasClass('disabled')) {
              e.preventDefault();
              return;
            }

            // Act as regular link if target attribute is specified.
            if (!!tabLink.attr('target')) {
              return;
            }

            // Make the old tab inactive.
            this.$activeTabLink.removeClass('active');
            var $oldContent = this.$content;

            // Update the variables with the new link and content
            this.$activeTabLink = tabLink;
            this.$content = $(M.escapeHash(tabLink[0].hash));
            this.$tabLinks = this.$el.children('li.tab').children('a');

            // Make the tab active.
            this.$activeTabLink.addClass('active');
            var prevIndex = this.index;
            this.index = Math.max(this.$tabLinks.index(tabLink), 0);

            // Swap content
            if (this.options.swipeable) {
              if (this._tabsCarousel) {
                this._tabsCarousel.set(this.index, function () {
                  if (typeof _this23.options.onShow === 'function') {
                    _this23.options.onShow.call(_this23, _this23.$content[0]);
                  }
                });
              }
            } else {
              if (this.$content.length) {
                this.$content[0].style.display = 'block';
                this.$content.addClass('active');
                if (typeof this.options.onShow === 'function') {
                  this.options.onShow.call(this, this.$content[0]);
                }

                if ($oldContent.length && !$oldContent.is(this.$content)) {
                  $oldContent[0].style.display = 'none';
                  $oldContent.removeClass('active');
                }
              }
            }

            // Update widths after content is swapped (scrollbar bugfix)
            this._setTabsAndTabWidth();

            // Update indicator
            this._animateIndicator(prevIndex);

            // Prevent the anchor's default click action
            e.preventDefault();
          }

          /**
           * Generate elements for tab indicator.
           */

        }, {
          key: "_createIndicator",
          value: function _createIndicator() {
            var _this24 = this;

            var indicator = document.createElement('li');
            indicator.classList.add('indicator');

            this.el.appendChild(indicator);
            this._indicator = indicator;

            setTimeout(function () {
              _this24._indicator.style.left = _this24._calcLeftPos(_this24.$activeTabLink) + 'px';
              _this24._indicator.style.right = _this24._calcRightPos(_this24.$activeTabLink) + 'px';
            }, 0);
          }

          /**
           * Setup first active tab link.
           */

        }, {
          key: "_setupActiveTabLink",
          value: function _setupActiveTabLink() {
            // If the location.hash matches one of the links, use that as the active tab.
            this.$activeTabLink = $(this.$tabLinks.filter('[href="' + location.hash + '"]'));

            // If no match is found, use the first link or any with class 'active' as the initial active tab.
            if (this.$activeTabLink.length === 0) {
              this.$activeTabLink = this.$el.children('li.tab').children('a.active').first();
            }
            if (this.$activeTabLink.length === 0) {
              this.$activeTabLink = this.$el.children('li.tab').children('a').first();
            }

            this.$tabLinks.removeClass('active');
            this.$activeTabLink[0].classList.add('active');

            this.index = Math.max(this.$tabLinks.index(this.$activeTabLink), 0);

            if (this.$activeTabLink.length) {
              this.$content = $(M.escapeHash(this.$activeTabLink[0].hash));
              this.$content.addClass('active');
            }
          }

          /**
           * Setup swipeable tabs
           */

        }, {
          key: "_setupSwipeableTabs",
          value: function _setupSwipeableTabs() {
            var _this25 = this;

            // Change swipeable according to responsive threshold
            if (window.innerWidth > this.options.responsiveThreshold) {
              this.options.swipeable = false;
            }

            var $tabsContent = $();
            this.$tabLinks.each(function (link) {
              var $currContent = $(M.escapeHash(link.hash));
              $currContent.addClass('carousel-item');
              $tabsContent = $tabsContent.add($currContent);
            });

            var $tabsWrapper = $('<div class="tabs-content carousel carousel-slider"></div>');
            $tabsContent.first().before($tabsWrapper);
            $tabsWrapper.append($tabsContent);
            $tabsContent[0].style.display = '';

            // Keep active tab index to set initial carousel slide
            var activeTabIndex = this.$activeTabLink.closest('.tab').index();

            this._tabsCarousel = M.Carousel.init($tabsWrapper[0], {
              fullWidth: true,
              noWrap: true,
              onCycleTo: function (item) {
                var prevIndex = _this25.index;
                _this25.index = $(item).index();
                _this25.$activeTabLink.removeClass('active');
                _this25.$activeTabLink = _this25.$tabLinks.eq(_this25.index);
                _this25.$activeTabLink.addClass('active');
                _this25._animateIndicator(prevIndex);
                if (typeof _this25.options.onShow === 'function') {
                  _this25.options.onShow.call(_this25, _this25.$content[0]);
                }
              }
            });

            // Set initial carousel slide to active tab
            this._tabsCarousel.set(activeTabIndex);
          }

          /**
           * Teardown normal tabs.
           */

        }, {
          key: "_teardownSwipeableTabs",
          value: function _teardownSwipeableTabs() {
            var $tabsWrapper = this._tabsCarousel.$el;
            this._tabsCarousel.destroy();

            // Unwrap
            $tabsWrapper.after($tabsWrapper.children());
            $tabsWrapper.remove();
          }

          /**
           * Setup normal tabs.
           */

        }, {
          key: "_setupNormalTabs",
          value: function _setupNormalTabs() {
            // Hide Tabs Content
            this.$tabLinks.not(this.$activeTabLink).each(function (link) {
              if (!!link.hash) {
                var $currContent = $(M.escapeHash(link.hash));
                if ($currContent.length) {
                  $currContent[0].style.display = 'none';
                }
              }
            });
          }

          /**
           * Teardown normal tabs.
           */

        }, {
          key: "_teardownNormalTabs",
          value: function _teardownNormalTabs() {
            // show Tabs Content
            this.$tabLinks.each(function (link) {
              if (!!link.hash) {
                var $currContent = $(M.escapeHash(link.hash));
                if ($currContent.length) {
                  $currContent[0].style.display = '';
                }
              }
            });
          }

          /**
           * set tabs and tab width
           */

        }, {
          key: "_setTabsAndTabWidth",
          value: function _setTabsAndTabWidth() {
            this.tabsWidth = this.$el.width();
            this.tabWidth = Math.max(this.tabsWidth, this.el.scrollWidth) / this.$tabLinks.length;
          }

          /**
           * Finds right attribute for indicator based on active tab.
           * @param {cash} el
           */

        }, {
          key: "_calcRightPos",
          value: function _calcRightPos(el) {
            return Math.ceil(this.tabsWidth - el.position().left - el[0].getBoundingClientRect().width);
          }

          /**
           * Finds left attribute for indicator based on active tab.
           * @param {cash} el
           */

        }, {
          key: "_calcLeftPos",
          value: function _calcLeftPos(el) {
            return Math.floor(el.position().left);
          }
        }, {
          key: "updateTabIndicator",
          value: function updateTabIndicator() {
            this._setTabsAndTabWidth();
            this._animateIndicator(this.index);
          }

          /**
           * Animates Indicator to active tab.
           * @param {Number} prevIndex
           */

        }, {
          key: "_animateIndicator",
          value: function _animateIndicator(prevIndex) {
            var leftDelay = 0,
                rightDelay = 0;

            if (this.index - prevIndex >= 0) {
              leftDelay = 90;
            } else {
              rightDelay = 90;
            }

            // Animate
            var animOptions = {
              targets: this._indicator,
              left: {
                value: this._calcLeftPos(this.$activeTabLink),
                delay: leftDelay
              },
              right: {
                value: this._calcRightPos(this.$activeTabLink),
                delay: rightDelay
              },
              duration: this.options.duration,
              easing: 'easeOutQuad'
            };
            anim.remove(this._indicator);
            anim(animOptions);
          }

          /**
           * Select tab.
           * @param {String} tabId
           */

        }, {
          key: "select",
          value: function select(tabId) {
            var tab = this.$tabLinks.filter('[href="#' + tabId + '"]');
            if (tab.length) {
              tab.trigger('click');
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Tabs.__proto__ || Object.getPrototypeOf(Tabs), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Tabs;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Tabs;
      }(Component);

      M.Tabs = Tabs;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Tabs, 'tabs', 'M_Tabs');
      }
    })(cash, M.anime);
    (function ($, anim) {

      var _defaults = {
        exitDelay: 200,
        enterDelay: 0,
        html: null,
        margin: 5,
        inDuration: 250,
        outDuration: 200,
        position: 'bottom',
        transitionMovement: 10
      };

      /**
       * @class
       *
       */

      var Tooltip = function (_Component7) {
        _inherits(Tooltip, _Component7);

        /**
         * Construct Tooltip instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Tooltip(el, options) {
          _classCallCheck(this, Tooltip);

          var _this26 = _possibleConstructorReturn(this, (Tooltip.__proto__ || Object.getPrototypeOf(Tooltip)).call(this, Tooltip, el, options));

          _this26.el.M_Tooltip = _this26;
          _this26.options = $.extend({}, Tooltip.defaults, options);

          _this26.isOpen = false;
          _this26.isHovered = false;
          _this26.isFocused = false;
          _this26._appendTooltipEl();
          _this26._setupEventHandlers();
          return _this26;
        }

        _createClass(Tooltip, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            $(this.tooltipEl).remove();
            this._removeEventHandlers();
            this.el.M_Tooltip = undefined;
          }
        }, {
          key: "_appendTooltipEl",
          value: function _appendTooltipEl() {
            var tooltipEl = document.createElement('div');
            tooltipEl.classList.add('material-tooltip');
            this.tooltipEl = tooltipEl;

            var tooltipContentEl = document.createElement('div');
            tooltipContentEl.classList.add('tooltip-content');
            tooltipContentEl.innerHTML = this.options.html;
            tooltipEl.appendChild(tooltipContentEl);
            document.body.appendChild(tooltipEl);
          }
        }, {
          key: "_updateTooltipContent",
          value: function _updateTooltipContent() {
            this.tooltipEl.querySelector('.tooltip-content').innerHTML = this.options.html;
          }
        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleMouseEnterBound = this._handleMouseEnter.bind(this);
            this._handleMouseLeaveBound = this._handleMouseLeave.bind(this);
            this._handleFocusBound = this._handleFocus.bind(this);
            this._handleBlurBound = this._handleBlur.bind(this);
            this.el.addEventListener('mouseenter', this._handleMouseEnterBound);
            this.el.addEventListener('mouseleave', this._handleMouseLeaveBound);
            this.el.addEventListener('focus', this._handleFocusBound, true);
            this.el.addEventListener('blur', this._handleBlurBound, true);
          }
        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('mouseenter', this._handleMouseEnterBound);
            this.el.removeEventListener('mouseleave', this._handleMouseLeaveBound);
            this.el.removeEventListener('focus', this._handleFocusBound, true);
            this.el.removeEventListener('blur', this._handleBlurBound, true);
          }
        }, {
          key: "open",
          value: function open(isManual) {
            if (this.isOpen) {
              return;
            }
            isManual = isManual === undefined ? true : undefined; // Default value true
            this.isOpen = true;
            // Update tooltip content with HTML attribute options
            this.options = $.extend({}, this.options, this._getAttributeOptions());
            this._updateTooltipContent();
            this._setEnterDelayTimeout(isManual);
          }
        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }

            this.isHovered = false;
            this.isFocused = false;
            this.isOpen = false;
            this._setExitDelayTimeout();
          }

          /**
           * Create timeout which delays when the tooltip closes
           */

        }, {
          key: "_setExitDelayTimeout",
          value: function _setExitDelayTimeout() {
            var _this27 = this;

            clearTimeout(this._exitDelayTimeout);

            this._exitDelayTimeout = setTimeout(function () {
              if (_this27.isHovered || _this27.isFocused) {
                return;
              }

              _this27._animateOut();
            }, this.options.exitDelay);
          }

          /**
           * Create timeout which delays when the toast closes
           */

        }, {
          key: "_setEnterDelayTimeout",
          value: function _setEnterDelayTimeout(isManual) {
            var _this28 = this;

            clearTimeout(this._enterDelayTimeout);

            this._enterDelayTimeout = setTimeout(function () {
              if (!_this28.isHovered && !_this28.isFocused && !isManual) {
                return;
              }

              _this28._animateIn();
            }, this.options.enterDelay);
          }
        }, {
          key: "_positionTooltip",
          value: function _positionTooltip() {
            var origin = this.el,
                tooltip = this.tooltipEl,
                originHeight = origin.offsetHeight,
                originWidth = origin.offsetWidth,
                tooltipHeight = tooltip.offsetHeight,
                tooltipWidth = tooltip.offsetWidth,
                newCoordinates = void 0,
                margin = this.options.margin,
                targetTop = void 0,
                targetLeft = void 0;

            this.xMovement = 0, this.yMovement = 0;

            targetTop = origin.getBoundingClientRect().top + M.getDocumentScrollTop();
            targetLeft = origin.getBoundingClientRect().left + M.getDocumentScrollLeft();

            if (this.options.position === 'top') {
              targetTop += -tooltipHeight - margin;
              targetLeft += originWidth / 2 - tooltipWidth / 2;
              this.yMovement = -this.options.transitionMovement;
            } else if (this.options.position === 'right') {
              targetTop += originHeight / 2 - tooltipHeight / 2;
              targetLeft += originWidth + margin;
              this.xMovement = this.options.transitionMovement;
            } else if (this.options.position === 'left') {
              targetTop += originHeight / 2 - tooltipHeight / 2;
              targetLeft += -tooltipWidth - margin;
              this.xMovement = -this.options.transitionMovement;
            } else {
              targetTop += originHeight + margin;
              targetLeft += originWidth / 2 - tooltipWidth / 2;
              this.yMovement = this.options.transitionMovement;
            }

            newCoordinates = this._repositionWithinScreen(targetLeft, targetTop, tooltipWidth, tooltipHeight);
            $(tooltip).css({
              top: newCoordinates.y + 'px',
              left: newCoordinates.x + 'px'
            });
          }
        }, {
          key: "_repositionWithinScreen",
          value: function _repositionWithinScreen(x, y, width, height) {
            var scrollLeft = M.getDocumentScrollLeft();
            var scrollTop = M.getDocumentScrollTop();
            var newX = x - scrollLeft;
            var newY = y - scrollTop;

            var bounding = {
              left: newX,
              top: newY,
              width: width,
              height: height
            };

            var offset = this.options.margin + this.options.transitionMovement;
            var edges = M.checkWithinContainer(document.body, bounding, offset);

            if (edges.left) {
              newX = offset;
            } else if (edges.right) {
              newX -= newX + width - window.innerWidth;
            }

            if (edges.top) {
              newY = offset;
            } else if (edges.bottom) {
              newY -= newY + height - window.innerHeight;
            }

            return {
              x: newX + scrollLeft,
              y: newY + scrollTop
            };
          }
        }, {
          key: "_animateIn",
          value: function _animateIn() {
            this._positionTooltip();
            this.tooltipEl.style.visibility = 'visible';
            anim.remove(this.tooltipEl);
            anim({
              targets: this.tooltipEl,
              opacity: 1,
              translateX: this.xMovement,
              translateY: this.yMovement,
              duration: this.options.inDuration,
              easing: 'easeOutCubic'
            });
          }
        }, {
          key: "_animateOut",
          value: function _animateOut() {
            anim.remove(this.tooltipEl);
            anim({
              targets: this.tooltipEl,
              opacity: 0,
              translateX: 0,
              translateY: 0,
              duration: this.options.outDuration,
              easing: 'easeOutCubic'
            });
          }
        }, {
          key: "_handleMouseEnter",
          value: function _handleMouseEnter() {
            this.isHovered = true;
            this.isFocused = false; // Allows close of tooltip when opened by focus.
            this.open(false);
          }
        }, {
          key: "_handleMouseLeave",
          value: function _handleMouseLeave() {
            this.isHovered = false;
            this.isFocused = false; // Allows close of tooltip when opened by focus.
            this.close();
          }
        }, {
          key: "_handleFocus",
          value: function _handleFocus() {
            if (M.tabPressed) {
              this.isFocused = true;
              this.open(false);
            }
          }
        }, {
          key: "_handleBlur",
          value: function _handleBlur() {
            this.isFocused = false;
            this.close();
          }
        }, {
          key: "_getAttributeOptions",
          value: function _getAttributeOptions() {
            var attributeOptions = {};
            var tooltipTextOption = this.el.getAttribute('data-tooltip');
            var positionOption = this.el.getAttribute('data-position');

            if (tooltipTextOption) {
              attributeOptions.html = tooltipTextOption;
            }

            if (positionOption) {
              attributeOptions.position = positionOption;
            }
            return attributeOptions;
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Tooltip.__proto__ || Object.getPrototypeOf(Tooltip), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Tooltip;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Tooltip;
      }(Component);

      M.Tooltip = Tooltip;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Tooltip, 'tooltip', 'M_Tooltip');
      }
    })(cash, M.anime);
    (function (window) {

      var Waves = Waves || {};
      var $$ = document.querySelectorAll.bind(document);

      // Find exact position of element
      function isWindow(obj) {
        return obj !== null && obj === obj.window;
      }

      function getWindow(elem) {
        return isWindow(elem) ? elem : elem.nodeType === 9 && elem.defaultView;
      }

      function offset(elem) {
        var docElem,
            win,
            box = { top: 0, left: 0 },
            doc = elem && elem.ownerDocument;

        docElem = doc.documentElement;

        if (typeof elem.getBoundingClientRect !== typeof undefined) {
          box = elem.getBoundingClientRect();
        }
        win = getWindow(doc);
        return {
          top: box.top + win.pageYOffset - docElem.clientTop,
          left: box.left + win.pageXOffset - docElem.clientLeft
        };
      }

      function convertStyle(obj) {
        var style = '';

        for (var a in obj) {
          if (obj.hasOwnProperty(a)) {
            style += a + ':' + obj[a] + ';';
          }
        }

        return style;
      }

      var Effect = {

        // Effect delay
        duration: 750,

        show: function (e, element) {

          // Disable right click
          if (e.button === 2) {
            return false;
          }

          var el = element || this;

          // Create ripple
          var ripple = document.createElement('div');
          ripple.className = 'waves-ripple';
          el.appendChild(ripple);

          // Get click coordinate and element witdh
          var pos = offset(el);
          var relativeY = e.pageY - pos.top;
          var relativeX = e.pageX - pos.left;
          var scale = 'scale(' + el.clientWidth / 100 * 10 + ')';

          // Support for touch devices
          if ('touches' in e) {
            relativeY = e.touches[0].pageY - pos.top;
            relativeX = e.touches[0].pageX - pos.left;
          }

          // Attach data to element
          ripple.setAttribute('data-hold', Date.now());
          ripple.setAttribute('data-scale', scale);
          ripple.setAttribute('data-x', relativeX);
          ripple.setAttribute('data-y', relativeY);

          // Set ripple position
          var rippleStyle = {
            'top': relativeY + 'px',
            'left': relativeX + 'px'
          };

          ripple.className = ripple.className + ' waves-notransition';
          ripple.setAttribute('style', convertStyle(rippleStyle));
          ripple.className = ripple.className.replace('waves-notransition', '');

          // Scale the ripple
          rippleStyle['-webkit-transform'] = scale;
          rippleStyle['-moz-transform'] = scale;
          rippleStyle['-ms-transform'] = scale;
          rippleStyle['-o-transform'] = scale;
          rippleStyle.transform = scale;
          rippleStyle.opacity = '1';

          rippleStyle['-webkit-transition-duration'] = Effect.duration + 'ms';
          rippleStyle['-moz-transition-duration'] = Effect.duration + 'ms';
          rippleStyle['-o-transition-duration'] = Effect.duration + 'ms';
          rippleStyle['transition-duration'] = Effect.duration + 'ms';

          rippleStyle['-webkit-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
          rippleStyle['-moz-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
          rippleStyle['-o-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
          rippleStyle['transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';

          ripple.setAttribute('style', convertStyle(rippleStyle));
        },

        hide: function (e) {
          TouchHandler.touchup(e);

          var el = this;
          var width = el.clientWidth * 1.4;

          // Get first ripple
          var ripple = null;
          var ripples = el.getElementsByClassName('waves-ripple');
          if (ripples.length > 0) {
            ripple = ripples[ripples.length - 1];
          } else {
            return false;
          }

          var relativeX = ripple.getAttribute('data-x');
          var relativeY = ripple.getAttribute('data-y');
          var scale = ripple.getAttribute('data-scale');

          // Get delay beetween mousedown and mouse leave
          var diff = Date.now() - Number(ripple.getAttribute('data-hold'));
          var delay = 350 - diff;

          if (delay < 0) {
            delay = 0;
          }

          // Fade out ripple after delay
          setTimeout(function () {
            var style = {
              'top': relativeY + 'px',
              'left': relativeX + 'px',
              'opacity': '0',

              // Duration
              '-webkit-transition-duration': Effect.duration + 'ms',
              '-moz-transition-duration': Effect.duration + 'ms',
              '-o-transition-duration': Effect.duration + 'ms',
              'transition-duration': Effect.duration + 'ms',
              '-webkit-transform': scale,
              '-moz-transform': scale,
              '-ms-transform': scale,
              '-o-transform': scale,
              'transform': scale
            };

            ripple.setAttribute('style', convertStyle(style));

            setTimeout(function () {
              try {
                el.removeChild(ripple);
              } catch (e) {
                return false;
              }
            }, Effect.duration);
          }, delay);
        },

        // Little hack to make <input> can perform waves effect
        wrapInput: function (elements) {
          for (var a = 0; a < elements.length; a++) {
            var el = elements[a];

            if (el.tagName.toLowerCase() === 'input') {
              var parent = el.parentNode;

              // If input already have parent just pass through
              if (parent.tagName.toLowerCase() === 'i' && parent.className.indexOf('waves-effect') !== -1) {
                continue;
              }

              // Put element class and style to the specified parent
              var wrapper = document.createElement('i');
              wrapper.className = el.className + ' waves-input-wrapper';

              var elementStyle = el.getAttribute('style');

              if (!elementStyle) {
                elementStyle = '';
              }

              wrapper.setAttribute('style', elementStyle);

              el.className = 'waves-button-input';
              el.removeAttribute('style');

              // Put element as child
              parent.replaceChild(wrapper, el);
              wrapper.appendChild(el);
            }
          }
        }
      };

      /**
       * Disable mousedown event for 500ms during and after touch
       */
      var TouchHandler = {
        /* uses an integer rather than bool so there's no issues with
         * needing to clear timeouts if another touch event occurred
         * within the 500ms. Cannot mouseup between touchstart and
         * touchend, nor in the 500ms after touchend. */
        touches: 0,
        allowEvent: function (e) {
          var allow = true;

          if (e.type === 'touchstart') {
            TouchHandler.touches += 1; //push
          } else if (e.type === 'touchend' || e.type === 'touchcancel') {
            setTimeout(function () {
              if (TouchHandler.touches > 0) {
                TouchHandler.touches -= 1; //pop after 500ms
              }
            }, 500);
          } else if (e.type === 'mousedown' && TouchHandler.touches > 0) {
            allow = false;
          }

          return allow;
        },
        touchup: function (e) {
          TouchHandler.allowEvent(e);
        }
      };

      /**
       * Delegated click handler for .waves-effect element.
       * returns null when .waves-effect element not in "click tree"
       */
      function getWavesEffectElement(e) {
        if (TouchHandler.allowEvent(e) === false) {
          return null;
        }

        var element = null;
        var target = e.target || e.srcElement;

        while (target.parentNode !== null) {
          if (!(target instanceof SVGElement) && target.className.indexOf('waves-effect') !== -1) {
            element = target;
            break;
          }
          target = target.parentNode;
        }
        return element;
      }

      /**
       * Bubble the click and show effect if .waves-effect elem was found
       */
      function showEffect(e) {
        var element = getWavesEffectElement(e);

        if (element !== null) {
          Effect.show(e, element);

          if ('ontouchstart' in window) {
            element.addEventListener('touchend', Effect.hide, false);
            element.addEventListener('touchcancel', Effect.hide, false);
          }

          element.addEventListener('mouseup', Effect.hide, false);
          element.addEventListener('mouseleave', Effect.hide, false);
          element.addEventListener('dragend', Effect.hide, false);
        }
      }

      Waves.displayEffect = function (options) {
        options = options || {};

        if ('duration' in options) {
          Effect.duration = options.duration;
        }

        //Wrap input inside <i> tag
        Effect.wrapInput($$('.waves-effect'));

        if ('ontouchstart' in window) {
          document.body.addEventListener('touchstart', showEffect, false);
        }

        document.body.addEventListener('mousedown', showEffect, false);
      };

      /**
       * Attach Waves to an input element (or any element which doesn't
       * bubble mouseup/mousedown events).
       *   Intended to be used with dynamically loaded forms/inputs, or
       * where the user doesn't want a delegated click handler.
       */
      Waves.attach = function (element) {
        //FUTURE: automatically add waves classes and allow users
        // to specify them with an options param? Eg. light/classic/button
        if (element.tagName.toLowerCase() === 'input') {
          Effect.wrapInput([element]);
          element = element.parentNode;
        }

        if ('ontouchstart' in window) {
          element.addEventListener('touchstart', showEffect, false);
        }

        element.addEventListener('mousedown', showEffect, false);
      };

      window.Waves = Waves;

      document.addEventListener('DOMContentLoaded', function () {
        Waves.displayEffect();
      }, false);
    })(window);
    (function ($, anim) {

      var _defaults = {
        html: '',
        displayLength: 4000,
        inDuration: 300,
        outDuration: 375,
        classes: '',
        completeCallback: null,
        activationPercent: 0.8
      };

      var Toast = function () {
        function Toast(options) {
          _classCallCheck(this, Toast);

          /**
           * Options for the toast
           * @member Toast#options
           */
          this.options = $.extend({}, Toast.defaults, options);
          this.message = this.options.html;

          /**
           * Describes current pan state toast
           * @type {Boolean}
           */
          this.panning = false;

          /**
           * Time remaining until toast is removed
           */
          this.timeRemaining = this.options.displayLength;

          if (Toast._toasts.length === 0) {
            Toast._createContainer();
          }

          // Create new toast
          Toast._toasts.push(this);
          var toastElement = this._createToast();
          toastElement.M_Toast = this;
          this.el = toastElement;
          this.$el = $(toastElement);
          this._animateIn();
          this._setTimer();
        }

        _createClass(Toast, [{
          key: "_createToast",


          /**
           * Create toast and append it to toast container
           */
          value: function _createToast() {
            var toast = document.createElement('div');
            toast.classList.add('toast');

            // Add custom classes onto toast
            if (!!this.options.classes.length) {
              $(toast).addClass(this.options.classes);
            }

            // Set content
            if (typeof HTMLElement === 'object' ? this.message instanceof HTMLElement : this.message && typeof this.message === 'object' && this.message !== null && this.message.nodeType === 1 && typeof this.message.nodeName === 'string') {
              toast.appendChild(this.message);

              // Check if it is jQuery object
            } else if (!!this.message.jquery) {
              $(toast).append(this.message[0]);

              // Insert as html;
            } else {
              toast.innerHTML = this.message;
            }

            // Append toasft
            Toast._container.appendChild(toast);
            return toast;
          }

          /**
           * Animate in toast
           */

        }, {
          key: "_animateIn",
          value: function _animateIn() {
            // Animate toast in
            anim({
              targets: this.el,
              top: 0,
              opacity: 1,
              duration: this.options.inDuration,
              easing: 'easeOutCubic'
            });
          }

          /**
           * Create setInterval which automatically removes toast when timeRemaining >= 0
           * has been reached
           */

        }, {
          key: "_setTimer",
          value: function _setTimer() {
            var _this29 = this;

            if (this.timeRemaining !== Infinity) {
              this.counterInterval = setInterval(function () {
                // If toast is not being dragged, decrease its time remaining
                if (!_this29.panning) {
                  _this29.timeRemaining -= 20;
                }

                // Animate toast out
                if (_this29.timeRemaining <= 0) {
                  _this29.dismiss();
                }
              }, 20);
            }
          }

          /**
           * Dismiss toast with animation
           */

        }, {
          key: "dismiss",
          value: function dismiss() {
            var _this30 = this;

            window.clearInterval(this.counterInterval);
            var activationDistance = this.el.offsetWidth * this.options.activationPercent;

            if (this.wasSwiped) {
              this.el.style.transition = 'transform .05s, opacity .05s';
              this.el.style.transform = "translateX(" + activationDistance + "px)";
              this.el.style.opacity = 0;
            }

            anim({
              targets: this.el,
              opacity: 0,
              marginTop: -40,
              duration: this.options.outDuration,
              easing: 'easeOutExpo',
              complete: function () {
                // Call the optional callback
                if (typeof _this30.options.completeCallback === 'function') {
                  _this30.options.completeCallback();
                }
                // Remove toast from DOM
                _this30.$el.remove();
                Toast._toasts.splice(Toast._toasts.indexOf(_this30), 1);
                if (Toast._toasts.length === 0) {
                  Toast._removeContainer();
                }
              }
            });
          }
        }], [{
          key: "getInstance",


          /**
           * Get Instance
           */
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Toast;
          }

          /**
           * Append toast container and add event handlers
           */

        }, {
          key: "_createContainer",
          value: function _createContainer() {
            var container = document.createElement('div');
            container.setAttribute('id', 'toast-container');

            // Add event handler
            container.addEventListener('touchstart', Toast._onDragStart);
            container.addEventListener('touchmove', Toast._onDragMove);
            container.addEventListener('touchend', Toast._onDragEnd);

            container.addEventListener('mousedown', Toast._onDragStart);
            document.addEventListener('mousemove', Toast._onDragMove);
            document.addEventListener('mouseup', Toast._onDragEnd);

            document.body.appendChild(container);
            Toast._container = container;
          }

          /**
           * Remove toast container and event handlers
           */

        }, {
          key: "_removeContainer",
          value: function _removeContainer() {
            // Add event handler
            document.removeEventListener('mousemove', Toast._onDragMove);
            document.removeEventListener('mouseup', Toast._onDragEnd);

            $(Toast._container).remove();
            Toast._container = null;
          }

          /**
           * Begin drag handler
           * @param {Event} e
           */

        }, {
          key: "_onDragStart",
          value: function _onDragStart(e) {
            if (e.target && $(e.target).closest('.toast').length) {
              var $toast = $(e.target).closest('.toast');
              var toast = $toast[0].M_Toast;
              toast.panning = true;
              Toast._draggedToast = toast;
              toast.el.classList.add('panning');
              toast.el.style.transition = '';
              toast.startingXPos = Toast._xPos(e);
              toast.time = Date.now();
              toast.xPos = Toast._xPos(e);
            }
          }

          /**
           * Drag move handler
           * @param {Event} e
           */

        }, {
          key: "_onDragMove",
          value: function _onDragMove(e) {
            if (!!Toast._draggedToast) {
              e.preventDefault();
              var toast = Toast._draggedToast;
              toast.deltaX = Math.abs(toast.xPos - Toast._xPos(e));
              toast.xPos = Toast._xPos(e);
              toast.velocityX = toast.deltaX / (Date.now() - toast.time);
              toast.time = Date.now();

              var totalDeltaX = toast.xPos - toast.startingXPos;
              var activationDistance = toast.el.offsetWidth * toast.options.activationPercent;
              toast.el.style.transform = "translateX(" + totalDeltaX + "px)";
              toast.el.style.opacity = 1 - Math.abs(totalDeltaX / activationDistance);
            }
          }

          /**
           * End drag handler
           */

        }, {
          key: "_onDragEnd",
          value: function _onDragEnd() {
            if (!!Toast._draggedToast) {
              var toast = Toast._draggedToast;
              toast.panning = false;
              toast.el.classList.remove('panning');

              var totalDeltaX = toast.xPos - toast.startingXPos;
              var activationDistance = toast.el.offsetWidth * toast.options.activationPercent;
              var shouldBeDismissed = Math.abs(totalDeltaX) > activationDistance || toast.velocityX > 1;

              // Remove toast
              if (shouldBeDismissed) {
                toast.wasSwiped = true;
                toast.dismiss();

                // Animate toast back to original position
              } else {
                toast.el.style.transition = 'transform .2s, opacity .2s';
                toast.el.style.transform = '';
                toast.el.style.opacity = '';
              }
              Toast._draggedToast = null;
            }
          }

          /**
           * Get x position of mouse or touch event
           * @param {Event} e
           */

        }, {
          key: "_xPos",
          value: function _xPos(e) {
            if (e.targetTouches && e.targetTouches.length >= 1) {
              return e.targetTouches[0].clientX;
            }
            // mouse event
            return e.clientX;
          }

          /**
           * Remove all toasts
           */

        }, {
          key: "dismissAll",
          value: function dismissAll() {
            for (var toastIndex in Toast._toasts) {
              Toast._toasts[toastIndex].dismiss();
            }
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Toast;
      }();

      /**
       * @static
       * @memberof Toast
       * @type {Array.<Toast>}
       */


      Toast._toasts = [];

      /**
       * @static
       * @memberof Toast
       */
      Toast._container = null;

      /**
       * @static
       * @memberof Toast
       * @type {Toast}
       */
      Toast._draggedToast = null;

      M.Toast = Toast;
      M.toast = function (options) {
        return new Toast(options);
      };
    })(cash, M.anime);
    (function ($, anim) {

      var _defaults = {
        edge: 'left',
        draggable: true,
        inDuration: 250,
        outDuration: 200,
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        preventScrolling: true
      };

      /**
       * @class
       */

      var Sidenav = function (_Component8) {
        _inherits(Sidenav, _Component8);

        /**
         * Construct Sidenav instance and set up overlay
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Sidenav(el, options) {
          _classCallCheck(this, Sidenav);

          var _this31 = _possibleConstructorReturn(this, (Sidenav.__proto__ || Object.getPrototypeOf(Sidenav)).call(this, Sidenav, el, options));

          _this31.el.M_Sidenav = _this31;
          _this31.id = _this31.$el.attr('id');

          /**
           * Options for the Sidenav
           * @member Sidenav#options
           * @prop {String} [edge='left'] - Side of screen on which Sidenav appears
           * @prop {Boolean} [draggable=true] - Allow swipe gestures to open/close Sidenav
           * @prop {Number} [inDuration=250] - Length in ms of enter transition
           * @prop {Number} [outDuration=200] - Length in ms of exit transition
           * @prop {Function} onOpenStart - Function called when sidenav starts entering
           * @prop {Function} onOpenEnd - Function called when sidenav finishes entering
           * @prop {Function} onCloseStart - Function called when sidenav starts exiting
           * @prop {Function} onCloseEnd - Function called when sidenav finishes exiting
           */
          _this31.options = $.extend({}, Sidenav.defaults, options);

          /**
           * Describes open/close state of Sidenav
           * @type {Boolean}
           */
          _this31.isOpen = false;

          /**
           * Describes if Sidenav is fixed
           * @type {Boolean}
           */
          _this31.isFixed = _this31.el.classList.contains('sidenav-fixed');

          /**
           * Describes if Sidenav is being draggeed
           * @type {Boolean}
           */
          _this31.isDragged = false;

          // Window size variables for window resize checks
          _this31.lastWindowWidth = window.innerWidth;
          _this31.lastWindowHeight = window.innerHeight;

          _this31._createOverlay();
          _this31._createDragTarget();
          _this31._setupEventHandlers();
          _this31._setupClasses();
          _this31._setupFixed();

          Sidenav._sidenavs.push(_this31);
          return _this31;
        }

        _createClass(Sidenav, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this._enableBodyScrolling();
            this._overlay.parentNode.removeChild(this._overlay);
            this.dragTarget.parentNode.removeChild(this.dragTarget);
            this.el.M_Sidenav = undefined;
            this.el.style.transform = '';

            var index = Sidenav._sidenavs.indexOf(this);
            if (index >= 0) {
              Sidenav._sidenavs.splice(index, 1);
            }
          }
        }, {
          key: "_createOverlay",
          value: function _createOverlay() {
            var overlay = document.createElement('div');
            this._closeBound = this.close.bind(this);
            overlay.classList.add('sidenav-overlay');

            overlay.addEventListener('click', this._closeBound);

            document.body.appendChild(overlay);
            this._overlay = overlay;
          }
        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            if (Sidenav._sidenavs.length === 0) {
              document.body.addEventListener('click', this._handleTriggerClick);
            }

            this._handleDragTargetDragBound = this._handleDragTargetDrag.bind(this);
            this._handleDragTargetReleaseBound = this._handleDragTargetRelease.bind(this);
            this._handleCloseDragBound = this._handleCloseDrag.bind(this);
            this._handleCloseReleaseBound = this._handleCloseRelease.bind(this);
            this._handleCloseTriggerClickBound = this._handleCloseTriggerClick.bind(this);

            this.dragTarget.addEventListener('touchmove', this._handleDragTargetDragBound);
            this.dragTarget.addEventListener('touchend', this._handleDragTargetReleaseBound);
            this._overlay.addEventListener('touchmove', this._handleCloseDragBound);
            this._overlay.addEventListener('touchend', this._handleCloseReleaseBound);
            this.el.addEventListener('touchmove', this._handleCloseDragBound);
            this.el.addEventListener('touchend', this._handleCloseReleaseBound);
            this.el.addEventListener('click', this._handleCloseTriggerClickBound);

            // Add resize for side nav fixed
            if (this.isFixed) {
              this._handleWindowResizeBound = this._handleWindowResize.bind(this);
              window.addEventListener('resize', this._handleWindowResizeBound);
            }
          }
        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            if (Sidenav._sidenavs.length === 1) {
              document.body.removeEventListener('click', this._handleTriggerClick);
            }

            this.dragTarget.removeEventListener('touchmove', this._handleDragTargetDragBound);
            this.dragTarget.removeEventListener('touchend', this._handleDragTargetReleaseBound);
            this._overlay.removeEventListener('touchmove', this._handleCloseDragBound);
            this._overlay.removeEventListener('touchend', this._handleCloseReleaseBound);
            this.el.removeEventListener('touchmove', this._handleCloseDragBound);
            this.el.removeEventListener('touchend', this._handleCloseReleaseBound);
            this.el.removeEventListener('click', this._handleCloseTriggerClickBound);

            // Remove resize for side nav fixed
            if (this.isFixed) {
              window.removeEventListener('resize', this._handleWindowResizeBound);
            }
          }

          /**
           * Handle Trigger Click
           * @param {Event} e
           */

        }, {
          key: "_handleTriggerClick",
          value: function _handleTriggerClick(e) {
            var $trigger = $(e.target).closest('.sidenav-trigger');
            if (e.target && $trigger.length) {
              var sidenavId = M.getIdFromTrigger($trigger[0]);

              var sidenavInstance = document.getElementById(sidenavId).M_Sidenav;
              if (sidenavInstance) {
                sidenavInstance.open($trigger);
              }
              e.preventDefault();
            }
          }

          /**
           * Set variables needed at the beggining of drag
           * and stop any current transition.
           * @param {Event} e
           */

        }, {
          key: "_startDrag",
          value: function _startDrag(e) {
            var clientX = e.targetTouches[0].clientX;
            this.isDragged = true;
            this._startingXpos = clientX;
            this._xPos = this._startingXpos;
            this._time = Date.now();
            this._width = this.el.getBoundingClientRect().width;
            this._overlay.style.display = 'block';
            this._initialScrollTop = this.isOpen ? this.el.scrollTop : M.getDocumentScrollTop();
            this._verticallyScrolling = false;
            anim.remove(this.el);
            anim.remove(this._overlay);
          }

          /**
           * Set variables needed at each drag move update tick
           * @param {Event} e
           */

        }, {
          key: "_dragMoveUpdate",
          value: function _dragMoveUpdate(e) {
            var clientX = e.targetTouches[0].clientX;
            var currentScrollTop = this.isOpen ? this.el.scrollTop : M.getDocumentScrollTop();
            this.deltaX = Math.abs(this._xPos - clientX);
            this._xPos = clientX;
            this.velocityX = this.deltaX / (Date.now() - this._time);
            this._time = Date.now();
            if (this._initialScrollTop !== currentScrollTop) {
              this._verticallyScrolling = true;
            }
          }

          /**
           * Handles Dragging of Sidenav
           * @param {Event} e
           */

        }, {
          key: "_handleDragTargetDrag",
          value: function _handleDragTargetDrag(e) {
            // Check if draggable
            if (!this.options.draggable || this._isCurrentlyFixed() || this._verticallyScrolling) {
              return;
            }

            // If not being dragged, set initial drag start variables
            if (!this.isDragged) {
              this._startDrag(e);
            }

            // Run touchmove updates
            this._dragMoveUpdate(e);

            // Calculate raw deltaX
            var totalDeltaX = this._xPos - this._startingXpos;

            // dragDirection is the attempted user drag direction
            var dragDirection = totalDeltaX > 0 ? 'right' : 'left';

            // Don't allow totalDeltaX to exceed Sidenav width or be dragged in the opposite direction
            totalDeltaX = Math.min(this._width, Math.abs(totalDeltaX));
            if (this.options.edge === dragDirection) {
              totalDeltaX = 0;
            }

            /**
             * transformX is the drag displacement
             * transformPrefix is the initial transform placement
             * Invert values if Sidenav is right edge
             */
            var transformX = totalDeltaX;
            var transformPrefix = 'translateX(-100%)';
            if (this.options.edge === 'right') {
              transformPrefix = 'translateX(100%)';
              transformX = -transformX;
            }

            // Calculate open/close percentage of sidenav, with open = 1 and close = 0
            this.percentOpen = Math.min(1, totalDeltaX / this._width);

            // Set transform and opacity styles
            this.el.style.transform = transformPrefix + " translateX(" + transformX + "px)";
            this._overlay.style.opacity = this.percentOpen;
          }

          /**
           * Handle Drag Target Release
           */

        }, {
          key: "_handleDragTargetRelease",
          value: function _handleDragTargetRelease() {
            if (this.isDragged) {
              if (this.percentOpen > 0.2) {
                this.open();
              } else {
                this._animateOut();
              }

              this.isDragged = false;
              this._verticallyScrolling = false;
            }
          }

          /**
           * Handle Close Drag
           * @param {Event} e
           */

        }, {
          key: "_handleCloseDrag",
          value: function _handleCloseDrag(e) {
            if (this.isOpen) {
              // Check if draggable
              if (!this.options.draggable || this._isCurrentlyFixed() || this._verticallyScrolling) {
                return;
              }

              // If not being dragged, set initial drag start variables
              if (!this.isDragged) {
                this._startDrag(e);
              }

              // Run touchmove updates
              this._dragMoveUpdate(e);

              // Calculate raw deltaX
              var totalDeltaX = this._xPos - this._startingXpos;

              // dragDirection is the attempted user drag direction
              var dragDirection = totalDeltaX > 0 ? 'right' : 'left';

              // Don't allow totalDeltaX to exceed Sidenav width or be dragged in the opposite direction
              totalDeltaX = Math.min(this._width, Math.abs(totalDeltaX));
              if (this.options.edge !== dragDirection) {
                totalDeltaX = 0;
              }

              var transformX = -totalDeltaX;
              if (this.options.edge === 'right') {
                transformX = -transformX;
              }

              // Calculate open/close percentage of sidenav, with open = 1 and close = 0
              this.percentOpen = Math.min(1, 1 - totalDeltaX / this._width);

              // Set transform and opacity styles
              this.el.style.transform = "translateX(" + transformX + "px)";
              this._overlay.style.opacity = this.percentOpen;
            }
          }

          /**
           * Handle Close Release
           */

        }, {
          key: "_handleCloseRelease",
          value: function _handleCloseRelease() {
            if (this.isOpen && this.isDragged) {
              if (this.percentOpen > 0.8) {
                this._animateIn();
              } else {
                this.close();
              }

              this.isDragged = false;
              this._verticallyScrolling = false;
            }
          }

          /**
           * Handles closing of Sidenav when element with class .sidenav-close
           */

        }, {
          key: "_handleCloseTriggerClick",
          value: function _handleCloseTriggerClick(e) {
            var $closeTrigger = $(e.target).closest('.sidenav-close');
            if ($closeTrigger.length && !this._isCurrentlyFixed()) {
              this.close();
            }
          }

          /**
           * Handle Window Resize
           */

        }, {
          key: "_handleWindowResize",
          value: function _handleWindowResize() {
            // Only handle horizontal resizes
            if (this.lastWindowWidth !== window.innerWidth) {
              if (window.innerWidth > 992) {
                this.open();
              } else {
                this.close();
              }
            }

            this.lastWindowWidth = window.innerWidth;
            this.lastWindowHeight = window.innerHeight;
          }
        }, {
          key: "_setupClasses",
          value: function _setupClasses() {
            if (this.options.edge === 'right') {
              this.el.classList.add('right-aligned');
              this.dragTarget.classList.add('right-aligned');
            }
          }
        }, {
          key: "_removeClasses",
          value: function _removeClasses() {
            this.el.classList.remove('right-aligned');
            this.dragTarget.classList.remove('right-aligned');
          }
        }, {
          key: "_setupFixed",
          value: function _setupFixed() {
            if (this._isCurrentlyFixed()) {
              this.open();
            }
          }
        }, {
          key: "_isCurrentlyFixed",
          value: function _isCurrentlyFixed() {
            return this.isFixed && window.innerWidth > 992;
          }
        }, {
          key: "_createDragTarget",
          value: function _createDragTarget() {
            var dragTarget = document.createElement('div');
            dragTarget.classList.add('drag-target');
            document.body.appendChild(dragTarget);
            this.dragTarget = dragTarget;
          }
        }, {
          key: "_preventBodyScrolling",
          value: function _preventBodyScrolling() {
            var body = document.body;
            body.style.overflow = 'hidden';
          }
        }, {
          key: "_enableBodyScrolling",
          value: function _enableBodyScrolling() {
            var body = document.body;
            body.style.overflow = '';
          }
        }, {
          key: "open",
          value: function open() {
            if (this.isOpen === true) {
              return;
            }

            this.isOpen = true;

            // Run onOpenStart callback
            if (typeof this.options.onOpenStart === 'function') {
              this.options.onOpenStart.call(this, this.el);
            }

            // Handle fixed Sidenav
            if (this._isCurrentlyFixed()) {
              anim.remove(this.el);
              anim({
                targets: this.el,
                translateX: 0,
                duration: 0,
                easing: 'easeOutQuad'
              });
              this._enableBodyScrolling();
              this._overlay.style.display = 'none';

              // Handle non-fixed Sidenav
            } else {
              if (this.options.preventScrolling) {
                this._preventBodyScrolling();
              }

              if (!this.isDragged || this.percentOpen != 1) {
                this._animateIn();
              }
            }
          }
        }, {
          key: "close",
          value: function close() {
            if (this.isOpen === false) {
              return;
            }

            this.isOpen = false;

            // Run onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
              this.options.onCloseStart.call(this, this.el);
            }

            // Handle fixed Sidenav
            if (this._isCurrentlyFixed()) {
              var transformX = this.options.edge === 'left' ? '-105%' : '105%';
              this.el.style.transform = "translateX(" + transformX + ")";

              // Handle non-fixed Sidenav
            } else {
              this._enableBodyScrolling();

              if (!this.isDragged || this.percentOpen != 0) {
                this._animateOut();
              } else {
                this._overlay.style.display = 'none';
              }
            }
          }
        }, {
          key: "_animateIn",
          value: function _animateIn() {
            this._animateSidenavIn();
            this._animateOverlayIn();
          }
        }, {
          key: "_animateSidenavIn",
          value: function _animateSidenavIn() {
            var _this32 = this;

            var slideOutPercent = this.options.edge === 'left' ? -1 : 1;
            if (this.isDragged) {
              slideOutPercent = this.options.edge === 'left' ? slideOutPercent + this.percentOpen : slideOutPercent - this.percentOpen;
            }

            anim.remove(this.el);
            anim({
              targets: this.el,
              translateX: [slideOutPercent * 100 + "%", 0],
              duration: this.options.inDuration,
              easing: 'easeOutQuad',
              complete: function () {
                // Run onOpenEnd callback
                if (typeof _this32.options.onOpenEnd === 'function') {
                  _this32.options.onOpenEnd.call(_this32, _this32.el);
                }
              }
            });
          }
        }, {
          key: "_animateOverlayIn",
          value: function _animateOverlayIn() {
            var start = 0;
            if (this.isDragged) {
              start = this.percentOpen;
            } else {
              $(this._overlay).css({
                display: 'block'
              });
            }

            anim.remove(this._overlay);
            anim({
              targets: this._overlay,
              opacity: [start, 1],
              duration: this.options.inDuration,
              easing: 'easeOutQuad'
            });
          }
        }, {
          key: "_animateOut",
          value: function _animateOut() {
            this._animateSidenavOut();
            this._animateOverlayOut();
          }
        }, {
          key: "_animateSidenavOut",
          value: function _animateSidenavOut() {
            var _this33 = this;

            var endPercent = this.options.edge === 'left' ? -1 : 1;
            var slideOutPercent = 0;
            if (this.isDragged) {
              slideOutPercent = this.options.edge === 'left' ? endPercent + this.percentOpen : endPercent - this.percentOpen;
            }

            anim.remove(this.el);
            anim({
              targets: this.el,
              translateX: [slideOutPercent * 100 + "%", endPercent * 105 + "%"],
              duration: this.options.outDuration,
              easing: 'easeOutQuad',
              complete: function () {
                // Run onOpenEnd callback
                if (typeof _this33.options.onCloseEnd === 'function') {
                  _this33.options.onCloseEnd.call(_this33, _this33.el);
                }
              }
            });
          }
        }, {
          key: "_animateOverlayOut",
          value: function _animateOverlayOut() {
            var _this34 = this;

            anim.remove(this._overlay);
            anim({
              targets: this._overlay,
              opacity: 0,
              duration: this.options.outDuration,
              easing: 'easeOutQuad',
              complete: function () {
                $(_this34._overlay).css('display', 'none');
              }
            });
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Sidenav.__proto__ || Object.getPrototypeOf(Sidenav), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Sidenav;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Sidenav;
      }(Component);

      /**
       * @static
       * @memberof Sidenav
       * @type {Array.<Sidenav>}
       */


      Sidenav._sidenavs = [];

      M.Sidenav = Sidenav;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Sidenav, 'sidenav', 'M_Sidenav');
      }
    })(cash, M.anime);
    (function ($, anim) {

      var _defaults = {
        throttle: 100,
        scrollOffset: 200, // offset - 200 allows elements near bottom of page to scroll
        activeClass: 'active',
        getActiveElement: function (id) {
          return 'a[href="#' + id + '"]';
        }
      };

      /**
       * @class
       *
       */

      var ScrollSpy = function (_Component9) {
        _inherits(ScrollSpy, _Component9);

        /**
         * Construct ScrollSpy instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function ScrollSpy(el, options) {
          _classCallCheck(this, ScrollSpy);

          var _this35 = _possibleConstructorReturn(this, (ScrollSpy.__proto__ || Object.getPrototypeOf(ScrollSpy)).call(this, ScrollSpy, el, options));

          _this35.el.M_ScrollSpy = _this35;

          /**
           * Options for the modal
           * @member Modal#options
           * @prop {Number} [throttle=100] - Throttle of scroll handler
           * @prop {Number} [scrollOffset=200] - Offset for centering element when scrolled to
           * @prop {String} [activeClass='active'] - Class applied to active elements
           * @prop {Function} [getActiveElement] - Used to find active element
           */
          _this35.options = $.extend({}, ScrollSpy.defaults, options);

          // setup
          ScrollSpy._elements.push(_this35);
          ScrollSpy._count++;
          ScrollSpy._increment++;
          _this35.tickId = -1;
          _this35.id = ScrollSpy._increment;
          _this35._setupEventHandlers();
          _this35._handleWindowScroll();
          return _this35;
        }

        _createClass(ScrollSpy, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            ScrollSpy._elements.splice(ScrollSpy._elements.indexOf(this), 1);
            ScrollSpy._elementsInView.splice(ScrollSpy._elementsInView.indexOf(this), 1);
            ScrollSpy._visibleElements.splice(ScrollSpy._visibleElements.indexOf(this.$el), 1);
            ScrollSpy._count--;
            this._removeEventHandlers();
            $(this.options.getActiveElement(this.$el.attr('id'))).removeClass(this.options.activeClass);
            this.el.M_ScrollSpy = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            var throttledResize = M.throttle(this._handleWindowScroll, 200);
            this._handleThrottledResizeBound = throttledResize.bind(this);
            this._handleWindowScrollBound = this._handleWindowScroll.bind(this);
            if (ScrollSpy._count === 1) {
              window.addEventListener('scroll', this._handleWindowScrollBound);
              window.addEventListener('resize', this._handleThrottledResizeBound);
              document.body.addEventListener('click', this._handleTriggerClick);
            }
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            if (ScrollSpy._count === 0) {
              window.removeEventListener('scroll', this._handleWindowScrollBound);
              window.removeEventListener('resize', this._handleThrottledResizeBound);
              document.body.removeEventListener('click', this._handleTriggerClick);
            }
          }

          /**
           * Handle Trigger Click
           * @param {Event} e
           */

        }, {
          key: "_handleTriggerClick",
          value: function _handleTriggerClick(e) {
            var $trigger = $(e.target);
            for (var i = ScrollSpy._elements.length - 1; i >= 0; i--) {
              var scrollspy = ScrollSpy._elements[i];
              if ($trigger.is('a[href="#' + scrollspy.$el.attr('id') + '"]')) {
                e.preventDefault();
                var offset = scrollspy.$el.offset().top + 1;

                anim({
                  targets: [document.documentElement, document.body],
                  scrollTop: offset - scrollspy.options.scrollOffset,
                  duration: 400,
                  easing: 'easeOutCubic'
                });
                break;
              }
            }
          }

          /**
           * Handle Window Scroll
           */

        }, {
          key: "_handleWindowScroll",
          value: function _handleWindowScroll() {
            // unique tick id
            ScrollSpy._ticks++;

            // viewport rectangle
            var top = M.getDocumentScrollTop(),
                left = M.getDocumentScrollLeft(),
                right = left + window.innerWidth,
                bottom = top + window.innerHeight;

            // determine which elements are in view
            var intersections = ScrollSpy._findElements(top, right, bottom, left);
            for (var i = 0; i < intersections.length; i++) {
              var scrollspy = intersections[i];
              var lastTick = scrollspy.tickId;
              if (lastTick < 0) {
                // entered into view
                scrollspy._enter();
              }

              // update tick id
              scrollspy.tickId = ScrollSpy._ticks;
            }

            for (var _i = 0; _i < ScrollSpy._elementsInView.length; _i++) {
              var _scrollspy = ScrollSpy._elementsInView[_i];
              var _lastTick = _scrollspy.tickId;
              if (_lastTick >= 0 && _lastTick !== ScrollSpy._ticks) {
                // exited from view
                _scrollspy._exit();
                _scrollspy.tickId = -1;
              }
            }

            // remember elements in view for next tick
            ScrollSpy._elementsInView = intersections;
          }

          /**
           * Find elements that are within the boundary
           * @param {number} top
           * @param {number} right
           * @param {number} bottom
           * @param {number} left
           * @return {Array.<ScrollSpy>}   A collection of elements
           */

        }, {
          key: "_enter",
          value: function _enter() {
            ScrollSpy._visibleElements = ScrollSpy._visibleElements.filter(function (value) {
              return value.height() != 0;
            });

            if (ScrollSpy._visibleElements[0]) {
              $(this.options.getActiveElement(ScrollSpy._visibleElements[0].attr('id'))).removeClass(this.options.activeClass);
              if (ScrollSpy._visibleElements[0][0].M_ScrollSpy && this.id < ScrollSpy._visibleElements[0][0].M_ScrollSpy.id) {
                ScrollSpy._visibleElements.unshift(this.$el);
              } else {
                ScrollSpy._visibleElements.push(this.$el);
              }
            } else {
              ScrollSpy._visibleElements.push(this.$el);
            }

            $(this.options.getActiveElement(ScrollSpy._visibleElements[0].attr('id'))).addClass(this.options.activeClass);
          }
        }, {
          key: "_exit",
          value: function _exit() {
            var _this36 = this;

            ScrollSpy._visibleElements = ScrollSpy._visibleElements.filter(function (value) {
              return value.height() != 0;
            });

            if (ScrollSpy._visibleElements[0]) {
              $(this.options.getActiveElement(ScrollSpy._visibleElements[0].attr('id'))).removeClass(this.options.activeClass);

              ScrollSpy._visibleElements = ScrollSpy._visibleElements.filter(function (el) {
                return el.attr('id') != _this36.$el.attr('id');
              });
              if (ScrollSpy._visibleElements[0]) {
                // Check if empty
                $(this.options.getActiveElement(ScrollSpy._visibleElements[0].attr('id'))).addClass(this.options.activeClass);
              }
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(ScrollSpy.__proto__ || Object.getPrototypeOf(ScrollSpy), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_ScrollSpy;
          }
        }, {
          key: "_findElements",
          value: function _findElements(top, right, bottom, left) {
            var hits = [];
            for (var i = 0; i < ScrollSpy._elements.length; i++) {
              var scrollspy = ScrollSpy._elements[i];
              var currTop = top + scrollspy.options.scrollOffset || 200;

              if (scrollspy.$el.height() > 0) {
                var elTop = scrollspy.$el.offset().top,
                    elLeft = scrollspy.$el.offset().left,
                    elRight = elLeft + scrollspy.$el.width(),
                    elBottom = elTop + scrollspy.$el.height();

                var isIntersect = !(elLeft > right || elRight < left || elTop > bottom || elBottom < currTop);

                if (isIntersect) {
                  hits.push(scrollspy);
                }
              }
            }
            return hits;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return ScrollSpy;
      }(Component);

      /**
       * @static
       * @memberof ScrollSpy
       * @type {Array.<ScrollSpy>}
       */


      ScrollSpy._elements = [];

      /**
       * @static
       * @memberof ScrollSpy
       * @type {Array.<ScrollSpy>}
       */
      ScrollSpy._elementsInView = [];

      /**
       * @static
       * @memberof ScrollSpy
       * @type {Array.<cash>}
       */
      ScrollSpy._visibleElements = [];

      /**
       * @static
       * @memberof ScrollSpy
       */
      ScrollSpy._count = 0;

      /**
       * @static
       * @memberof ScrollSpy
       */
      ScrollSpy._increment = 0;

      /**
       * @static
       * @memberof ScrollSpy
       */
      ScrollSpy._ticks = 0;

      M.ScrollSpy = ScrollSpy;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(ScrollSpy, 'scrollSpy', 'M_ScrollSpy');
      }
    })(cash, M.anime);
    (function ($) {

      var _defaults = {
        data: {}, // Autocomplete data set
        limit: Infinity, // Limit of results the autocomplete shows
        onAutocomplete: null, // Callback for when autocompleted
        minLength: 1, // Min characters before autocomplete starts
        sortFunction: function (a, b, inputString) {
          // Sort function for sorting autocomplete results
          return a.indexOf(inputString) - b.indexOf(inputString);
        }
      };

      /**
       * @class
       *
       */

      var Autocomplete = function (_Component10) {
        _inherits(Autocomplete, _Component10);

        /**
         * Construct Autocomplete instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Autocomplete(el, options) {
          _classCallCheck(this, Autocomplete);

          var _this37 = _possibleConstructorReturn(this, (Autocomplete.__proto__ || Object.getPrototypeOf(Autocomplete)).call(this, Autocomplete, el, options));

          _this37.el.M_Autocomplete = _this37;

          /**
           * Options for the autocomplete
           * @member Autocomplete#options
           * @prop {Number} duration
           * @prop {Number} dist
           * @prop {number} shift
           * @prop {number} padding
           * @prop {Boolean} fullWidth
           * @prop {Boolean} indicators
           * @prop {Boolean} noWrap
           * @prop {Function} onCycleTo
           */
          _this37.options = $.extend({}, Autocomplete.defaults, options);

          // Setup
          _this37.isOpen = false;
          _this37.count = 0;
          _this37.activeIndex = -1;
          _this37.oldVal;
          _this37.$inputField = _this37.$el.closest('.input-field');
          _this37.$active = $();
          _this37._mousedown = false;
          _this37._setupDropdown();

          _this37._setupEventHandlers();
          return _this37;
        }

        _createClass(Autocomplete, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this._removeDropdown();
            this.el.M_Autocomplete = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleInputBlurBound = this._handleInputBlur.bind(this);
            this._handleInputKeyupAndFocusBound = this._handleInputKeyupAndFocus.bind(this);
            this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
            this._handleInputClickBound = this._handleInputClick.bind(this);
            this._handleContainerMousedownAndTouchstartBound = this._handleContainerMousedownAndTouchstart.bind(this);
            this._handleContainerMouseupAndTouchendBound = this._handleContainerMouseupAndTouchend.bind(this);

            this.el.addEventListener('blur', this._handleInputBlurBound);
            this.el.addEventListener('keyup', this._handleInputKeyupAndFocusBound);
            this.el.addEventListener('focus', this._handleInputKeyupAndFocusBound);
            this.el.addEventListener('keydown', this._handleInputKeydownBound);
            this.el.addEventListener('click', this._handleInputClickBound);
            this.container.addEventListener('mousedown', this._handleContainerMousedownAndTouchstartBound);
            this.container.addEventListener('mouseup', this._handleContainerMouseupAndTouchendBound);

            if (typeof window.ontouchstart !== 'undefined') {
              this.container.addEventListener('touchstart', this._handleContainerMousedownAndTouchstartBound);
              this.container.addEventListener('touchend', this._handleContainerMouseupAndTouchendBound);
            }
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('blur', this._handleInputBlurBound);
            this.el.removeEventListener('keyup', this._handleInputKeyupAndFocusBound);
            this.el.removeEventListener('focus', this._handleInputKeyupAndFocusBound);
            this.el.removeEventListener('keydown', this._handleInputKeydownBound);
            this.el.removeEventListener('click', this._handleInputClickBound);
            this.container.removeEventListener('mousedown', this._handleContainerMousedownAndTouchstartBound);
            this.container.removeEventListener('mouseup', this._handleContainerMouseupAndTouchendBound);

            if (typeof window.ontouchstart !== 'undefined') {
              this.container.removeEventListener('touchstart', this._handleContainerMousedownAndTouchstartBound);
              this.container.removeEventListener('touchend', this._handleContainerMouseupAndTouchendBound);
            }
          }

          /**
           * Setup dropdown
           */

        }, {
          key: "_setupDropdown",
          value: function _setupDropdown() {
            var _this38 = this;

            this.container = document.createElement('ul');
            this.container.id = "autocomplete-options-" + M.guid();
            $(this.container).addClass('autocomplete-content dropdown-content');
            this.$inputField.append(this.container);
            this.el.setAttribute('data-target', this.container.id);

            this.dropdown = M.Dropdown.init(this.el, {
              autoFocus: false,
              closeOnClick: false,
              coverTrigger: false,
              onItemClick: function (itemEl) {
                _this38.selectOption($(itemEl));
              }
            });

            // Sketchy removal of dropdown click handler
            this.el.removeEventListener('click', this.dropdown._handleClickBound);
          }

          /**
           * Remove dropdown
           */

        }, {
          key: "_removeDropdown",
          value: function _removeDropdown() {
            this.container.parentNode.removeChild(this.container);
          }

          /**
           * Handle Input Blur
           */

        }, {
          key: "_handleInputBlur",
          value: function _handleInputBlur() {
            if (!this._mousedown) {
              this.close();
              this._resetAutocomplete();
            }
          }

          /**
           * Handle Input Keyup and Focus
           * @param {Event} e
           */

        }, {
          key: "_handleInputKeyupAndFocus",
          value: function _handleInputKeyupAndFocus(e) {
            if (e.type === 'keyup') {
              Autocomplete._keydown = false;
            }

            this.count = 0;
            var val = this.el.value.toLowerCase();

            // Don't capture enter or arrow key usage.
            if (e.keyCode === 13 || e.keyCode === 38 || e.keyCode === 40) {
              return;
            }

            // Check if the input isn't empty
            // Check if focus triggered by tab
            if (this.oldVal !== val && (M.tabPressed || e.type !== 'focus')) {
              this.open();
            }

            // Update oldVal
            this.oldVal = val;
          }

          /**
           * Handle Input Keydown
           * @param {Event} e
           */

        }, {
          key: "_handleInputKeydown",
          value: function _handleInputKeydown(e) {
            Autocomplete._keydown = true;

            // Arrow keys and enter key usage
            var keyCode = e.keyCode,
                liElement = void 0,
                numItems = $(this.container).children('li').length;

            // select element on Enter
            if (keyCode === M.keys.ENTER && this.activeIndex >= 0) {
              liElement = $(this.container).children('li').eq(this.activeIndex);
              if (liElement.length) {
                this.selectOption(liElement);
                e.preventDefault();
              }
              return;
            }

            // Capture up and down key
            if (keyCode === M.keys.ARROW_UP || keyCode === M.keys.ARROW_DOWN) {
              e.preventDefault();

              if (keyCode === M.keys.ARROW_UP && this.activeIndex > 0) {
                this.activeIndex--;
              }

              if (keyCode === M.keys.ARROW_DOWN && this.activeIndex < numItems - 1) {
                this.activeIndex++;
              }

              this.$active.removeClass('active');
              if (this.activeIndex >= 0) {
                this.$active = $(this.container).children('li').eq(this.activeIndex);
                this.$active.addClass('active');
              }
            }
          }

          /**
           * Handle Input Click
           * @param {Event} e
           */

        }, {
          key: "_handleInputClick",
          value: function _handleInputClick(e) {
            this.open();
          }

          /**
           * Handle Container Mousedown and Touchstart
           * @param {Event} e
           */

        }, {
          key: "_handleContainerMousedownAndTouchstart",
          value: function _handleContainerMousedownAndTouchstart(e) {
            this._mousedown = true;
          }

          /**
           * Handle Container Mouseup and Touchend
           * @param {Event} e
           */

        }, {
          key: "_handleContainerMouseupAndTouchend",
          value: function _handleContainerMouseupAndTouchend(e) {
            this._mousedown = false;
          }

          /**
           * Highlight partial match
           */

        }, {
          key: "_highlight",
          value: function _highlight(string, $el) {
            var img = $el.find('img');
            var matchStart = $el.text().toLowerCase().indexOf('' + string.toLowerCase() + ''),
                matchEnd = matchStart + string.length - 1,
                beforeMatch = $el.text().slice(0, matchStart),
                matchText = $el.text().slice(matchStart, matchEnd + 1),
                afterMatch = $el.text().slice(matchEnd + 1);
            $el.html("<span>" + beforeMatch + "<span class='highlight'>" + matchText + "</span>" + afterMatch + "</span>");
            if (img.length) {
              $el.prepend(img);
            }
          }

          /**
           * Reset current element position
           */

        }, {
          key: "_resetCurrentElement",
          value: function _resetCurrentElement() {
            this.activeIndex = -1;
            this.$active.removeClass('active');
          }

          /**
           * Reset autocomplete elements
           */

        }, {
          key: "_resetAutocomplete",
          value: function _resetAutocomplete() {
            $(this.container).empty();
            this._resetCurrentElement();
            this.oldVal = null;
            this.isOpen = false;
            this._mousedown = false;
          }

          /**
           * Select autocomplete option
           * @param {Element} el  Autocomplete option list item element
           */

        }, {
          key: "selectOption",
          value: function selectOption(el) {
            var text = el.text().trim();
            this.el.value = text;
            this.$el.trigger('change');
            this._resetAutocomplete();
            this.close();

            // Handle onAutocomplete callback.
            if (typeof this.options.onAutocomplete === 'function') {
              this.options.onAutocomplete.call(this, text);
            }
          }

          /**
           * Render dropdown content
           * @param {Object} data  data set
           * @param {String} val  current input value
           */

        }, {
          key: "_renderDropdown",
          value: function _renderDropdown(data, val) {
            var _this39 = this;

            this._resetAutocomplete();

            var matchingData = [];

            // Gather all matching data
            for (var key in data) {
              if (data.hasOwnProperty(key) && key.toLowerCase().indexOf(val) !== -1) {
                // Break if past limit
                if (this.count >= this.options.limit) {
                  break;
                }

                var entry = {
                  data: data[key],
                  key: key
                };
                matchingData.push(entry);

                this.count++;
              }
            }

            // Sort
            if (this.options.sortFunction) {
              var sortFunctionBound = function (a, b) {
                return _this39.options.sortFunction(a.key.toLowerCase(), b.key.toLowerCase(), val.toLowerCase());
              };
              matchingData.sort(sortFunctionBound);
            }

            // Render
            for (var i = 0; i < matchingData.length; i++) {
              var _entry = matchingData[i];
              var $autocompleteOption = $('<li></li>');
              if (!!_entry.data) {
                $autocompleteOption.append("<img src=\"" + _entry.data + "\" class=\"right circle\"><span>" + _entry.key + "</span>");
              } else {
                $autocompleteOption.append('<span>' + _entry.key + '</span>');
              }

              $(this.container).append($autocompleteOption);
              this._highlight(val, $autocompleteOption);
            }
          }

          /**
           * Open Autocomplete Dropdown
           */

        }, {
          key: "open",
          value: function open() {
            var val = this.el.value.toLowerCase();

            this._resetAutocomplete();

            if (val.length >= this.options.minLength) {
              this.isOpen = true;
              this._renderDropdown(this.options.data, val);
            }

            // Open dropdown
            if (!this.dropdown.isOpen) {
              this.dropdown.open();
            } else {
              // Recalculate dropdown when its already open
              this.dropdown.recalculateDimensions();
            }
          }

          /**
           * Close Autocomplete Dropdown
           */

        }, {
          key: "close",
          value: function close() {
            this.dropdown.close();
          }

          /**
           * Update Data
           * @param {Object} data
           */

        }, {
          key: "updateData",
          value: function updateData(data) {
            var val = this.el.value.toLowerCase();
            this.options.data = data;

            if (this.isOpen) {
              this._renderDropdown(data, val);
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Autocomplete.__proto__ || Object.getPrototypeOf(Autocomplete), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Autocomplete;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Autocomplete;
      }(Component);

      /**
       * @static
       * @memberof Autocomplete
       */


      Autocomplete._keydown = false;

      M.Autocomplete = Autocomplete;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Autocomplete, 'autocomplete', 'M_Autocomplete');
      }
    })(cash);
    (function ($) {
      // Function to update labels of text fields
      M.updateTextFields = function () {
        var input_selector = 'input[type=text], input[type=password], input[type=email], input[type=url], input[type=tel], input[type=number], input[type=search], input[type=date], input[type=time], textarea';
        $(input_selector).each(function (element, index) {
          var $this = $(this);
          if (element.value.length > 0 || $(element).is(':focus') || element.autofocus || $this.attr('placeholder') !== null) {
            $this.siblings('label').addClass('active');
          } else if (element.validity) {
            $this.siblings('label').toggleClass('active', element.validity.badInput === true);
          } else {
            $this.siblings('label').removeClass('active');
          }
        });
      };

      M.validate_field = function (object) {
        var hasLength = object.attr('data-length') !== null;
        var lenAttr = parseInt(object.attr('data-length'));
        var len = object[0].value.length;

        if (len === 0 && object[0].validity.badInput === false && !object.is(':required')) {
          if (object.hasClass('validate')) {
            object.removeClass('valid');
            object.removeClass('invalid');
          }
        } else {
          if (object.hasClass('validate')) {
            // Check for character counter attributes
            if (object.is(':valid') && hasLength && len <= lenAttr || object.is(':valid') && !hasLength) {
              object.removeClass('invalid');
              object.addClass('valid');
            } else {
              object.removeClass('valid');
              object.addClass('invalid');
            }
          }
        }
      };

      M.textareaAutoResize = function ($textarea) {
        // Wrap if native element
        if ($textarea instanceof Element) {
          $textarea = $($textarea);
        }

        if (!$textarea.length) {
          console.error('No textarea element found');
          return;
        }

        // Textarea Auto Resize
        var hiddenDiv = $('.hiddendiv').first();
        if (!hiddenDiv.length) {
          hiddenDiv = $('<div class="hiddendiv common"></div>');
          $('body').append(hiddenDiv);
        }

        // Set font properties of hiddenDiv
        var fontFamily = $textarea.css('font-family');
        var fontSize = $textarea.css('font-size');
        var lineHeight = $textarea.css('line-height');

        // Firefox can't handle padding shorthand.
        var paddingTop = $textarea.css('padding-top');
        var paddingRight = $textarea.css('padding-right');
        var paddingBottom = $textarea.css('padding-bottom');
        var paddingLeft = $textarea.css('padding-left');

        if (fontSize) {
          hiddenDiv.css('font-size', fontSize);
        }
        if (fontFamily) {
          hiddenDiv.css('font-family', fontFamily);
        }
        if (lineHeight) {
          hiddenDiv.css('line-height', lineHeight);
        }
        if (paddingTop) {
          hiddenDiv.css('padding-top', paddingTop);
        }
        if (paddingRight) {
          hiddenDiv.css('padding-right', paddingRight);
        }
        if (paddingBottom) {
          hiddenDiv.css('padding-bottom', paddingBottom);
        }
        if (paddingLeft) {
          hiddenDiv.css('padding-left', paddingLeft);
        }

        // Set original-height, if none
        if (!$textarea.data('original-height')) {
          $textarea.data('original-height', $textarea.height());
        }

        if ($textarea.attr('wrap') === 'off') {
          hiddenDiv.css('overflow-wrap', 'normal').css('white-space', 'pre');
        }

        hiddenDiv.text($textarea[0].value + '\n');
        var content = hiddenDiv.html().replace(/\n/g, '<br>');
        hiddenDiv.html(content);

        // When textarea is hidden, width goes crazy.
        // Approximate with half of window size

        if ($textarea[0].offsetWidth > 0 && $textarea[0].offsetHeight > 0) {
          hiddenDiv.css('width', $textarea.width() + 'px');
        } else {
          hiddenDiv.css('width', window.innerWidth / 2 + 'px');
        }

        /**
         * Resize if the new height is greater than the
         * original height of the textarea
         */
        if ($textarea.data('original-height') <= hiddenDiv.innerHeight()) {
          $textarea.css('height', hiddenDiv.innerHeight() + 'px');
        } else if ($textarea[0].value.length < $textarea.data('previous-length')) {
          /**
           * In case the new height is less than original height, it
           * means the textarea has less text than before
           * So we set the height to the original one
           */
          $textarea.css('height', $textarea.data('original-height') + 'px');
        }
        $textarea.data('previous-length', $textarea[0].value.length);
      };

      $(document).ready(function () {
        // Text based inputs
        var input_selector = 'input[type=text], input[type=password], input[type=email], input[type=url], input[type=tel], input[type=number], input[type=search], input[type=date], input[type=time], textarea';

        // Add active if form auto complete
        $(document).on('change', input_selector, function () {
          if (this.value.length !== 0 || $(this).attr('placeholder') !== null) {
            $(this).siblings('label').addClass('active');
          }
          M.validate_field($(this));
        });

        // Add active if input element has been pre-populated on document ready
        $(document).ready(function () {
          M.updateTextFields();
        });

        // HTML DOM FORM RESET handling
        $(document).on('reset', function (e) {
          var formReset = $(e.target);
          if (formReset.is('form')) {
            formReset.find(input_selector).removeClass('valid').removeClass('invalid');
            formReset.find(input_selector).each(function (e) {
              if (this.value.length) {
                $(this).siblings('label').removeClass('active');
              }
            });

            // Reset select (after native reset)
            setTimeout(function () {
              formReset.find('select').each(function () {
                // check if initialized
                if (this.M_FormSelect) {
                  $(this).trigger('change');
                }
              });
            }, 0);
          }
        });

        /**
         * Add active when element has focus
         * @param {Event} e
         */
        document.addEventListener('focus', function (e) {
          if ($(e.target).is(input_selector)) {
            $(e.target).siblings('label, .prefix').addClass('active');
          }
        }, true);

        /**
         * Remove active when element is blurred
         * @param {Event} e
         */
        document.addEventListener('blur', function (e) {
          var $inputElement = $(e.target);
          if ($inputElement.is(input_selector)) {
            var selector = '.prefix';

            if ($inputElement[0].value.length === 0 && $inputElement[0].validity.badInput !== true && $inputElement.attr('placeholder') === null) {
              selector += ', label';
            }
            $inputElement.siblings(selector).removeClass('active');
            M.validate_field($inputElement);
          }
        }, true);

        // Radio and Checkbox focus class
        var radio_checkbox = 'input[type=radio], input[type=checkbox]';
        $(document).on('keyup', radio_checkbox, function (e) {
          // TAB, check if tabbing to radio or checkbox.
          if (e.which === M.keys.TAB) {
            $(this).addClass('tabbed');
            var $this = $(this);
            $this.one('blur', function (e) {
              $(this).removeClass('tabbed');
            });
            return;
          }
        });

        var text_area_selector = '.materialize-textarea';
        $(text_area_selector).each(function () {
          var $textarea = $(this);
          /**
           * Resize textarea on document load after storing
           * the original height and the original length
           */
          $textarea.data('original-height', $textarea.height());
          $textarea.data('previous-length', this.value.length);
          M.textareaAutoResize($textarea);
        });

        $(document).on('keyup', text_area_selector, function () {
          M.textareaAutoResize($(this));
        });
        $(document).on('keydown', text_area_selector, function () {
          M.textareaAutoResize($(this));
        });

        // File Input Path
        $(document).on('change', '.file-field input[type="file"]', function () {
          var file_field = $(this).closest('.file-field');
          var path_input = file_field.find('input.file-path');
          var files = $(this)[0].files;
          var file_names = [];
          for (var i = 0; i < files.length; i++) {
            file_names.push(files[i].name);
          }
          path_input[0].value = file_names.join(', ');
          path_input.trigger('change');
        });
      }); // End of $(document).ready
    })(cash);
    (function ($, anim) {

      var _defaults = {
        indicators: true,
        height: 400,
        duration: 500,
        interval: 6000
      };

      /**
       * @class
       *
       */

      var Slider = function (_Component11) {
        _inherits(Slider, _Component11);

        /**
         * Construct Slider instance and set up overlay
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Slider(el, options) {
          _classCallCheck(this, Slider);

          var _this40 = _possibleConstructorReturn(this, (Slider.__proto__ || Object.getPrototypeOf(Slider)).call(this, Slider, el, options));

          _this40.el.M_Slider = _this40;

          /**
           * Options for the modal
           * @member Slider#options
           * @prop {Boolean} [indicators=true] - Show indicators
           * @prop {Number} [height=400] - height of slider
           * @prop {Number} [duration=500] - Length in ms of slide transition
           * @prop {Number} [interval=6000] - Length in ms of slide interval
           */
          _this40.options = $.extend({}, Slider.defaults, options);

          // setup
          _this40.$slider = _this40.$el.find('.slides');
          _this40.$slides = _this40.$slider.children('li');
          _this40.activeIndex = _this40.$slides.filter(function (item) {
            return $(item).hasClass('active');
          }).first().index();
          if (_this40.activeIndex != -1) {
            _this40.$active = _this40.$slides.eq(_this40.activeIndex);
          }

          _this40._setSliderHeight();

          // Set initial positions of captions
          _this40.$slides.find('.caption').each(function (el) {
            _this40._animateCaptionIn(el, 0);
          });

          // Move img src into background-image
          _this40.$slides.find('img').each(function (el) {
            var placeholderBase64 = 'data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            if ($(el).attr('src') !== placeholderBase64) {
              $(el).css('background-image', 'url("' + $(el).attr('src') + '")');
              $(el).attr('src', placeholderBase64);
            }
          });

          _this40._setupIndicators();

          // Show active slide
          if (_this40.$active) {
            _this40.$active.css('display', 'block');
          } else {
            _this40.$slides.first().addClass('active');
            anim({
              targets: _this40.$slides.first()[0],
              opacity: 1,
              duration: _this40.options.duration,
              easing: 'easeOutQuad'
            });

            _this40.activeIndex = 0;
            _this40.$active = _this40.$slides.eq(_this40.activeIndex);

            // Update indicators
            if (_this40.options.indicators) {
              _this40.$indicators.eq(_this40.activeIndex).addClass('active');
            }
          }

          // Adjust height to current slide
          _this40.$active.find('img').each(function (el) {
            anim({
              targets: _this40.$active.find('.caption')[0],
              opacity: 1,
              translateX: 0,
              translateY: 0,
              duration: _this40.options.duration,
              easing: 'easeOutQuad'
            });
          });

          _this40._setupEventHandlers();

          // auto scroll
          _this40.start();
          return _this40;
        }

        _createClass(Slider, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this.pause();
            this._removeIndicators();
            this._removeEventHandlers();
            this.el.M_Slider = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            var _this41 = this;

            this._handleIntervalBound = this._handleInterval.bind(this);
            this._handleIndicatorClickBound = this._handleIndicatorClick.bind(this);

            if (this.options.indicators) {
              this.$indicators.each(function (el) {
                el.addEventListener('click', _this41._handleIndicatorClickBound);
              });
            }
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            var _this42 = this;

            if (this.options.indicators) {
              this.$indicators.each(function (el) {
                el.removeEventListener('click', _this42._handleIndicatorClickBound);
              });
            }
          }

          /**
           * Handle indicator click
           * @param {Event} e
           */

        }, {
          key: "_handleIndicatorClick",
          value: function _handleIndicatorClick(e) {
            var currIndex = $(e.target).index();
            this.set(currIndex);
          }

          /**
           * Handle Interval
           */

        }, {
          key: "_handleInterval",
          value: function _handleInterval() {
            var newActiveIndex = this.$slider.find('.active').index();
            if (this.$slides.length === newActiveIndex + 1) newActiveIndex = 0;
            // loop to start
            else newActiveIndex += 1;

            this.set(newActiveIndex);
          }

          /**
           * Animate in caption
           * @param {Element} caption
           * @param {Number} duration
           */

        }, {
          key: "_animateCaptionIn",
          value: function _animateCaptionIn(caption, duration) {
            var animOptions = {
              targets: caption,
              opacity: 0,
              duration: duration,
              easing: 'easeOutQuad'
            };

            if ($(caption).hasClass('center-align')) {
              animOptions.translateY = -100;
            } else if ($(caption).hasClass('right-align')) {
              animOptions.translateX = 100;
            } else if ($(caption).hasClass('left-align')) {
              animOptions.translateX = -100;
            }

            anim(animOptions);
          }

          /**
           * Set height of slider
           */

        }, {
          key: "_setSliderHeight",
          value: function _setSliderHeight() {
            // If fullscreen, do nothing
            if (!this.$el.hasClass('fullscreen')) {
              if (this.options.indicators) {
                // Add height if indicators are present
                this.$el.css('height', this.options.height + 40 + 'px');
              } else {
                this.$el.css('height', this.options.height + 'px');
              }
              this.$slider.css('height', this.options.height + 'px');
            }
          }

          /**
           * Setup indicators
           */

        }, {
          key: "_setupIndicators",
          value: function _setupIndicators() {
            var _this43 = this;

            if (this.options.indicators) {
              this.$indicators = $('<ul class="indicators"></ul>');
              this.$slides.each(function (el, index) {
                var $indicator = $('<li class="indicator-item"></li>');
                _this43.$indicators.append($indicator[0]);
              });
              this.$el.append(this.$indicators[0]);
              this.$indicators = this.$indicators.children('li.indicator-item');
            }
          }

          /**
           * Remove indicators
           */

        }, {
          key: "_removeIndicators",
          value: function _removeIndicators() {
            this.$el.find('ul.indicators').remove();
          }

          /**
           * Cycle to nth item
           * @param {Number} index
           */

        }, {
          key: "set",
          value: function set(index) {
            var _this44 = this;

            // Wrap around indices.
            if (index >= this.$slides.length) index = 0;else if (index < 0) index = this.$slides.length - 1;

            // Only do if index changes
            if (this.activeIndex != index) {
              this.$active = this.$slides.eq(this.activeIndex);
              var $caption = this.$active.find('.caption');
              this.$active.removeClass('active');

              anim({
                targets: this.$active[0],
                opacity: 0,
                duration: this.options.duration,
                easing: 'easeOutQuad',
                complete: function () {
                  _this44.$slides.not('.active').each(function (el) {
                    anim({
                      targets: el,
                      opacity: 0,
                      translateX: 0,
                      translateY: 0,
                      duration: 0,
                      easing: 'easeOutQuad'
                    });
                  });
                }
              });

              this._animateCaptionIn($caption[0], this.options.duration);

              // Update indicators
              if (this.options.indicators) {
                this.$indicators.eq(this.activeIndex).removeClass('active');
                this.$indicators.eq(index).addClass('active');
              }

              anim({
                targets: this.$slides.eq(index)[0],
                opacity: 1,
                duration: this.options.duration,
                easing: 'easeOutQuad'
              });

              anim({
                targets: this.$slides.eq(index).find('.caption')[0],
                opacity: 1,
                translateX: 0,
                translateY: 0,
                duration: this.options.duration,
                delay: this.options.duration,
                easing: 'easeOutQuad'
              });

              this.$slides.eq(index).addClass('active');
              this.activeIndex = index;

              // Reset interval
              this.start();
            }
          }

          /**
           * Pause slider interval
           */

        }, {
          key: "pause",
          value: function pause() {
            clearInterval(this.interval);
          }

          /**
           * Start slider interval
           */

        }, {
          key: "start",
          value: function start() {
            clearInterval(this.interval);
            this.interval = setInterval(this._handleIntervalBound, this.options.duration + this.options.interval);
          }

          /**
           * Move to next slide
           */

        }, {
          key: "next",
          value: function next() {
            var newIndex = this.activeIndex + 1;

            // Wrap around indices.
            if (newIndex >= this.$slides.length) newIndex = 0;else if (newIndex < 0) newIndex = this.$slides.length - 1;

            this.set(newIndex);
          }

          /**
           * Move to previous slide
           */

        }, {
          key: "prev",
          value: function prev() {
            var newIndex = this.activeIndex - 1;

            // Wrap around indices.
            if (newIndex >= this.$slides.length) newIndex = 0;else if (newIndex < 0) newIndex = this.$slides.length - 1;

            this.set(newIndex);
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Slider.__proto__ || Object.getPrototypeOf(Slider), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Slider;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Slider;
      }(Component);

      M.Slider = Slider;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Slider, 'slider', 'M_Slider');
      }
    })(cash, M.anime);
    (function ($, anim) {
      $(document).on('click', '.card', function (e) {
        if ($(this).children('.card-reveal').length) {
          var $card = $(e.target).closest('.card');
          if ($card.data('initialOverflow') === undefined) {
            $card.data('initialOverflow', $card.css('overflow') === undefined ? '' : $card.css('overflow'));
          }
          var $cardReveal = $(this).find('.card-reveal');
          if ($(e.target).is($('.card-reveal .card-title')) || $(e.target).is($('.card-reveal .card-title i'))) {
            // Make Reveal animate down and display none
            anim({
              targets: $cardReveal[0],
              translateY: 0,
              duration: 225,
              easing: 'easeInOutQuad',
              complete: function (anim) {
                var el = anim.animatables[0].target;
                $(el).css({ display: 'none' });
                $card.css('overflow', $card.data('initialOverflow'));
              }
            });
          } else if ($(e.target).is($('.card .activator')) || $(e.target).is($('.card .activator i'))) {
            $card.css('overflow', 'hidden');
            $cardReveal.css({ display: 'block' });
            anim({
              targets: $cardReveal[0],
              translateY: '-100%',
              duration: 300,
              easing: 'easeInOutQuad'
            });
          }
        }
      });
    })(cash, M.anime);
    (function ($) {

      var _defaults = {
        data: [],
        placeholder: '',
        secondaryPlaceholder: '',
        autocompleteOptions: {},
        limit: Infinity,
        onChipAdd: null,
        onChipSelect: null,
        onChipDelete: null
      };

      /**
       * @typedef {Object} chip
       * @property {String} tag  chip tag string
       * @property {String} [image]  chip avatar image string
       */

      /**
       * @class
       *
       */

      var Chips = function (_Component12) {
        _inherits(Chips, _Component12);

        /**
         * Construct Chips instance and set up overlay
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Chips(el, options) {
          _classCallCheck(this, Chips);

          var _this45 = _possibleConstructorReturn(this, (Chips.__proto__ || Object.getPrototypeOf(Chips)).call(this, Chips, el, options));

          _this45.el.M_Chips = _this45;

          /**
           * Options for the modal
           * @member Chips#options
           * @prop {Array} data
           * @prop {String} placeholder
           * @prop {String} secondaryPlaceholder
           * @prop {Object} autocompleteOptions
           */
          _this45.options = $.extend({}, Chips.defaults, options);

          _this45.$el.addClass('chips input-field');
          _this45.chipsData = [];
          _this45.$chips = $();
          _this45._setupInput();
          _this45.hasAutocomplete = Object.keys(_this45.options.autocompleteOptions).length > 0;

          // Set input id
          if (!_this45.$input.attr('id')) {
            _this45.$input.attr('id', M.guid());
          }

          // Render initial chips
          if (_this45.options.data.length) {
            _this45.chipsData = _this45.options.data;
            _this45._renderChips(_this45.chipsData);
          }

          // Setup autocomplete if needed
          if (_this45.hasAutocomplete) {
            _this45._setupAutocomplete();
          }

          _this45._setPlaceholder();
          _this45._setupLabel();
          _this45._setupEventHandlers();
          return _this45;
        }

        _createClass(Chips, [{
          key: "getData",


          /**
           * Get Chips Data
           */
          value: function getData() {
            return this.chipsData;
          }

          /**
           * Teardown component
           */

        }, {
          key: "destroy",
          value: function destroy() {
            this._removeEventHandlers();
            this.$chips.remove();
            this.el.M_Chips = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleChipClickBound = this._handleChipClick.bind(this);
            this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
            this._handleInputFocusBound = this._handleInputFocus.bind(this);
            this._handleInputBlurBound = this._handleInputBlur.bind(this);

            this.el.addEventListener('click', this._handleChipClickBound);
            document.addEventListener('keydown', Chips._handleChipsKeydown);
            document.addEventListener('keyup', Chips._handleChipsKeyup);
            this.el.addEventListener('blur', Chips._handleChipsBlur, true);
            this.$input[0].addEventListener('focus', this._handleInputFocusBound);
            this.$input[0].addEventListener('blur', this._handleInputBlurBound);
            this.$input[0].addEventListener('keydown', this._handleInputKeydownBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('click', this._handleChipClickBound);
            document.removeEventListener('keydown', Chips._handleChipsKeydown);
            document.removeEventListener('keyup', Chips._handleChipsKeyup);
            this.el.removeEventListener('blur', Chips._handleChipsBlur, true);
            this.$input[0].removeEventListener('focus', this._handleInputFocusBound);
            this.$input[0].removeEventListener('blur', this._handleInputBlurBound);
            this.$input[0].removeEventListener('keydown', this._handleInputKeydownBound);
          }

          /**
           * Handle Chip Click
           * @param {Event} e
           */

        }, {
          key: "_handleChipClick",
          value: function _handleChipClick(e) {
            var $chip = $(e.target).closest('.chip');
            var clickedClose = $(e.target).is('.close');
            if ($chip.length) {
              var index = $chip.index();
              if (clickedClose) {
                // delete chip
                this.deleteChip(index);
                this.$input[0].focus();
              } else {
                // select chip
                this.selectChip(index);
              }

              // Default handle click to focus on input
            } else {
              this.$input[0].focus();
            }
          }

          /**
           * Handle Chips Keydown
           * @param {Event} e
           */

        }, {
          key: "_handleInputFocus",


          /**
           * Handle Input Focus
           */
          value: function _handleInputFocus() {
            this.$el.addClass('focus');
          }

          /**
           * Handle Input Blur
           */

        }, {
          key: "_handleInputBlur",
          value: function _handleInputBlur() {
            this.$el.removeClass('focus');
          }

          /**
           * Handle Input Keydown
           * @param {Event} e
           */

        }, {
          key: "_handleInputKeydown",
          value: function _handleInputKeydown(e) {
            Chips._keydown = true;

            // enter
            if (e.keyCode === 13) {
              // Override enter if autocompleting.
              if (this.hasAutocomplete && this.autocomplete && this.autocomplete.isOpen) {
                return;
              }

              e.preventDefault();
              this.addChip({
                tag: this.$input[0].value
              });
              this.$input[0].value = '';

              // delete or left
            } else if ((e.keyCode === 8 || e.keyCode === 37) && this.$input[0].value === '' && this.chipsData.length) {
              e.preventDefault();
              this.selectChip(this.chipsData.length - 1);
            }
          }

          /**
           * Render Chip
           * @param {chip} chip
           * @return {Element}
           */

        }, {
          key: "_renderChip",
          value: function _renderChip(chip) {
            if (!chip.tag) {
              return;
            }

            var renderedChip = document.createElement('div');
            var closeIcon = document.createElement('i');
            renderedChip.classList.add('chip');
            renderedChip.textContent = chip.tag;
            renderedChip.setAttribute('tabindex', 0);
            $(closeIcon).addClass('material-icons close');
            closeIcon.textContent = 'close';

            // attach image if needed
            if (chip.image) {
              var img = document.createElement('img');
              img.setAttribute('src', chip.image);
              renderedChip.insertBefore(img, renderedChip.firstChild);
            }

            renderedChip.appendChild(closeIcon);
            return renderedChip;
          }

          /**
           * Render Chips
           */

        }, {
          key: "_renderChips",
          value: function _renderChips() {
            this.$chips.remove();
            for (var i = 0; i < this.chipsData.length; i++) {
              var chipEl = this._renderChip(this.chipsData[i]);
              this.$el.append(chipEl);
              this.$chips.add(chipEl);
            }

            // move input to end
            this.$el.append(this.$input[0]);
          }

          /**
           * Setup Autocomplete
           */

        }, {
          key: "_setupAutocomplete",
          value: function _setupAutocomplete() {
            var _this46 = this;

            this.options.autocompleteOptions.onAutocomplete = function (val) {
              _this46.addChip({
                tag: val
              });
              _this46.$input[0].value = '';
              _this46.$input[0].focus();
            };

            this.autocomplete = M.Autocomplete.init(this.$input[0], this.options.autocompleteOptions);
          }

          /**
           * Setup Input
           */

        }, {
          key: "_setupInput",
          value: function _setupInput() {
            this.$input = this.$el.find('input');
            if (!this.$input.length) {
              this.$input = $('<input></input>');
              this.$el.append(this.$input);
            }

            this.$input.addClass('input');
          }

          /**
           * Setup Label
           */

        }, {
          key: "_setupLabel",
          value: function _setupLabel() {
            this.$label = this.$el.find('label');
            if (this.$label.length) {
              this.$label.setAttribute('for', this.$input.attr('id'));
            }
          }

          /**
           * Set placeholder
           */

        }, {
          key: "_setPlaceholder",
          value: function _setPlaceholder() {
            if (this.chipsData !== undefined && !this.chipsData.length && this.options.placeholder) {
              $(this.$input).prop('placeholder', this.options.placeholder);
            } else if ((this.chipsData === undefined || !!this.chipsData.length) && this.options.secondaryPlaceholder) {
              $(this.$input).prop('placeholder', this.options.secondaryPlaceholder);
            }
          }

          /**
           * Check if chip is valid
           * @param {chip} chip
           */

        }, {
          key: "_isValid",
          value: function _isValid(chip) {
            if (chip.hasOwnProperty('tag') && chip.tag !== '') {
              var exists = false;
              for (var i = 0; i < this.chipsData.length; i++) {
                if (this.chipsData[i].tag === chip.tag) {
                  exists = true;
                  break;
                }
              }
              return !exists;
            }

            return false;
          }

          /**
           * Add chip
           * @param {chip} chip
           */

        }, {
          key: "addChip",
          value: function addChip(chip) {
            if (!this._isValid(chip) || this.chipsData.length >= this.options.limit) {
              return;
            }

            var renderedChip = this._renderChip(chip);
            this.$chips.add(renderedChip);
            this.chipsData.push(chip);
            $(this.$input).before(renderedChip);
            this._setPlaceholder();

            // fire chipAdd callback
            if (typeof this.options.onChipAdd === 'function') {
              this.options.onChipAdd.call(this, this.$el, renderedChip);
            }
          }

          /**
           * Delete chip
           * @param {Number} chip
           */

        }, {
          key: "deleteChip",
          value: function deleteChip(chipIndex) {
            var $chip = this.$chips.eq(chipIndex);
            this.$chips.eq(chipIndex).remove();
            this.$chips = this.$chips.filter(function (el) {
              return $(el).index() >= 0;
            });
            this.chipsData.splice(chipIndex, 1);
            this._setPlaceholder();

            // fire chipDelete callback
            if (typeof this.options.onChipDelete === 'function') {
              this.options.onChipDelete.call(this, this.$el, $chip[0]);
            }
          }

          /**
           * Select chip
           * @param {Number} chip
           */

        }, {
          key: "selectChip",
          value: function selectChip(chipIndex) {
            var $chip = this.$chips.eq(chipIndex);
            this._selectedChip = $chip;
            $chip[0].focus();

            // fire chipSelect callback
            if (typeof this.options.onChipSelect === 'function') {
              this.options.onChipSelect.call(this, this.$el, $chip[0]);
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Chips.__proto__ || Object.getPrototypeOf(Chips), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Chips;
          }
        }, {
          key: "_handleChipsKeydown",
          value: function _handleChipsKeydown(e) {
            Chips._keydown = true;

            var $chips = $(e.target).closest('.chips');
            var chipsKeydown = e.target && $chips.length;

            // Don't handle keydown inputs on input and textarea
            if ($(e.target).is('input, textarea') || !chipsKeydown) {
              return;
            }

            var currChips = $chips[0].M_Chips;

            // backspace and delete
            if (e.keyCode === 8 || e.keyCode === 46) {
              e.preventDefault();

              var selectIndex = currChips.chipsData.length;
              if (currChips._selectedChip) {
                var index = currChips._selectedChip.index();
                currChips.deleteChip(index);
                currChips._selectedChip = null;

                // Make sure selectIndex doesn't go negative
                selectIndex = Math.max(index - 1, 0);
              }

              if (currChips.chipsData.length) {
                currChips.selectChip(selectIndex);
              }

              // left arrow key
            } else if (e.keyCode === 37) {
              if (currChips._selectedChip) {
                var _selectIndex = currChips._selectedChip.index() - 1;
                if (_selectIndex < 0) {
                  return;
                }
                currChips.selectChip(_selectIndex);
              }

              // right arrow key
            } else if (e.keyCode === 39) {
              if (currChips._selectedChip) {
                var _selectIndex2 = currChips._selectedChip.index() + 1;

                if (_selectIndex2 >= currChips.chipsData.length) {
                  currChips.$input[0].focus();
                } else {
                  currChips.selectChip(_selectIndex2);
                }
              }
            }
          }

          /**
           * Handle Chips Keyup
           * @param {Event} e
           */

        }, {
          key: "_handleChipsKeyup",
          value: function _handleChipsKeyup(e) {
            Chips._keydown = false;
          }

          /**
           * Handle Chips Blur
           * @param {Event} e
           */

        }, {
          key: "_handleChipsBlur",
          value: function _handleChipsBlur(e) {
            if (!Chips._keydown) {
              var $chips = $(e.target).closest('.chips');
              var currChips = $chips[0].M_Chips;

              currChips._selectedChip = null;
            }
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Chips;
      }(Component);

      /**
       * @static
       * @memberof Chips
       */


      Chips._keydown = false;

      M.Chips = Chips;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Chips, 'chips', 'M_Chips');
      }

      $(document).ready(function () {
        // Handle removal of static chips.
        $(document.body).on('click', '.chip .close', function () {
          var $chips = $(this).closest('.chips');
          if ($chips.length && $chips[0].M_Chips) {
            return;
          }
          $(this).closest('.chip').remove();
        });
      });
    })(cash);
    (function ($) {

      var _defaults = {
        top: 0,
        bottom: Infinity,
        offset: 0,
        onPositionChange: null
      };

      /**
       * @class
       *
       */

      var Pushpin = function (_Component13) {
        _inherits(Pushpin, _Component13);

        /**
         * Construct Pushpin instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Pushpin(el, options) {
          _classCallCheck(this, Pushpin);

          var _this47 = _possibleConstructorReturn(this, (Pushpin.__proto__ || Object.getPrototypeOf(Pushpin)).call(this, Pushpin, el, options));

          _this47.el.M_Pushpin = _this47;

          /**
           * Options for the modal
           * @member Pushpin#options
           */
          _this47.options = $.extend({}, Pushpin.defaults, options);

          _this47.originalOffset = _this47.el.offsetTop;
          Pushpin._pushpins.push(_this47);
          _this47._setupEventHandlers();
          _this47._updatePosition();
          return _this47;
        }

        _createClass(Pushpin, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this.el.style.top = null;
            this._removePinClasses();
            this._removeEventHandlers();

            // Remove pushpin Inst
            var index = Pushpin._pushpins.indexOf(this);
            Pushpin._pushpins.splice(index, 1);
          }
        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            document.addEventListener('scroll', Pushpin._updateElements);
          }
        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            document.removeEventListener('scroll', Pushpin._updateElements);
          }
        }, {
          key: "_updatePosition",
          value: function _updatePosition() {
            var scrolled = M.getDocumentScrollTop() + this.options.offset;

            if (this.options.top <= scrolled && this.options.bottom >= scrolled && !this.el.classList.contains('pinned')) {
              this._removePinClasses();
              this.el.style.top = this.options.offset + "px";
              this.el.classList.add('pinned');

              // onPositionChange callback
              if (typeof this.options.onPositionChange === 'function') {
                this.options.onPositionChange.call(this, 'pinned');
              }
            }

            // Add pin-top (when scrolled position is above top)
            if (scrolled < this.options.top && !this.el.classList.contains('pin-top')) {
              this._removePinClasses();
              this.el.style.top = 0;
              this.el.classList.add('pin-top');

              // onPositionChange callback
              if (typeof this.options.onPositionChange === 'function') {
                this.options.onPositionChange.call(this, 'pin-top');
              }
            }

            // Add pin-bottom (when scrolled position is below bottom)
            if (scrolled > this.options.bottom && !this.el.classList.contains('pin-bottom')) {
              this._removePinClasses();
              this.el.classList.add('pin-bottom');
              this.el.style.top = this.options.bottom - this.originalOffset + "px";

              // onPositionChange callback
              if (typeof this.options.onPositionChange === 'function') {
                this.options.onPositionChange.call(this, 'pin-bottom');
              }
            }
          }
        }, {
          key: "_removePinClasses",
          value: function _removePinClasses() {
            // IE 11 bug (can't remove multiple classes in one line)
            this.el.classList.remove('pin-top');
            this.el.classList.remove('pinned');
            this.el.classList.remove('pin-bottom');
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Pushpin.__proto__ || Object.getPrototypeOf(Pushpin), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Pushpin;
          }
        }, {
          key: "_updateElements",
          value: function _updateElements() {
            for (var elIndex in Pushpin._pushpins) {
              var pInstance = Pushpin._pushpins[elIndex];
              pInstance._updatePosition();
            }
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Pushpin;
      }(Component);

      /**
       * @static
       * @memberof Pushpin
       */


      Pushpin._pushpins = [];

      M.Pushpin = Pushpin;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Pushpin, 'pushpin', 'M_Pushpin');
      }
    })(cash);
    (function ($, anim) {

      var _defaults = {
        direction: 'top',
        hoverEnabled: true,
        toolbarEnabled: false
      };

      $.fn.reverse = [].reverse;

      /**
       * @class
       *
       */

      var FloatingActionButton = function (_Component14) {
        _inherits(FloatingActionButton, _Component14);

        /**
         * Construct FloatingActionButton instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function FloatingActionButton(el, options) {
          _classCallCheck(this, FloatingActionButton);

          var _this48 = _possibleConstructorReturn(this, (FloatingActionButton.__proto__ || Object.getPrototypeOf(FloatingActionButton)).call(this, FloatingActionButton, el, options));

          _this48.el.M_FloatingActionButton = _this48;

          /**
           * Options for the fab
           * @member FloatingActionButton#options
           * @prop {Boolean} [direction] - Direction fab menu opens
           * @prop {Boolean} [hoverEnabled=true] - Enable hover vs click
           * @prop {Boolean} [toolbarEnabled=false] - Enable toolbar transition
           */
          _this48.options = $.extend({}, FloatingActionButton.defaults, options);

          _this48.isOpen = false;
          _this48.$anchor = _this48.$el.children('a').first();
          _this48.$menu = _this48.$el.children('ul').first();
          _this48.$floatingBtns = _this48.$el.find('ul .btn-floating');
          _this48.$floatingBtnsReverse = _this48.$el.find('ul .btn-floating').reverse();
          _this48.offsetY = 0;
          _this48.offsetX = 0;

          _this48.$el.addClass("direction-" + _this48.options.direction);
          if (_this48.options.direction === 'top') {
            _this48.offsetY = 40;
          } else if (_this48.options.direction === 'right') {
            _this48.offsetX = -40;
          } else if (_this48.options.direction === 'bottom') {
            _this48.offsetY = -40;
          } else {
            _this48.offsetX = 40;
          }
          _this48._setupEventHandlers();
          return _this48;
        }

        _createClass(FloatingActionButton, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.el.M_FloatingActionButton = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleFABClickBound = this._handleFABClick.bind(this);
            this._handleOpenBound = this.open.bind(this);
            this._handleCloseBound = this.close.bind(this);

            if (this.options.hoverEnabled && !this.options.toolbarEnabled) {
              this.el.addEventListener('mouseenter', this._handleOpenBound);
              this.el.addEventListener('mouseleave', this._handleCloseBound);
            } else {
              this.el.addEventListener('click', this._handleFABClickBound);
            }
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            if (this.options.hoverEnabled && !this.options.toolbarEnabled) {
              this.el.removeEventListener('mouseenter', this._handleOpenBound);
              this.el.removeEventListener('mouseleave', this._handleCloseBound);
            } else {
              this.el.removeEventListener('click', this._handleFABClickBound);
            }
          }

          /**
           * Handle FAB Click
           */

        }, {
          key: "_handleFABClick",
          value: function _handleFABClick() {
            if (this.isOpen) {
              this.close();
            } else {
              this.open();
            }
          }

          /**
           * Handle Document Click
           * @param {Event} e
           */

        }, {
          key: "_handleDocumentClick",
          value: function _handleDocumentClick(e) {
            if (!$(e.target).closest(this.$menu).length) {
              this.close();
            }
          }

          /**
           * Open FAB
           */

        }, {
          key: "open",
          value: function open() {
            if (this.isOpen) {
              return;
            }

            if (this.options.toolbarEnabled) {
              this._animateInToolbar();
            } else {
              this._animateInFAB();
            }
            this.isOpen = true;
          }

          /**
           * Close FAB
           */

        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }

            if (this.options.toolbarEnabled) {
              window.removeEventListener('scroll', this._handleCloseBound, true);
              document.body.removeEventListener('click', this._handleDocumentClickBound, true);
              this._animateOutToolbar();
            } else {
              this._animateOutFAB();
            }
            this.isOpen = false;
          }

          /**
           * Classic FAB Menu open
           */

        }, {
          key: "_animateInFAB",
          value: function _animateInFAB() {
            var _this49 = this;

            this.$el.addClass('active');

            var time = 0;
            this.$floatingBtnsReverse.each(function (el) {
              anim({
                targets: el,
                opacity: 1,
                scale: [0.4, 1],
                translateY: [_this49.offsetY, 0],
                translateX: [_this49.offsetX, 0],
                duration: 275,
                delay: time,
                easing: 'easeInOutQuad'
              });
              time += 40;
            });
          }

          /**
           * Classic FAB Menu close
           */

        }, {
          key: "_animateOutFAB",
          value: function _animateOutFAB() {
            var _this50 = this;

            this.$floatingBtnsReverse.each(function (el) {
              anim.remove(el);
              anim({
                targets: el,
                opacity: 0,
                scale: 0.4,
                translateY: _this50.offsetY,
                translateX: _this50.offsetX,
                duration: 175,
                easing: 'easeOutQuad',
                complete: function () {
                  _this50.$el.removeClass('active');
                }
              });
            });
          }

          /**
           * Toolbar transition Menu open
           */

        }, {
          key: "_animateInToolbar",
          value: function _animateInToolbar() {
            var _this51 = this;

            var scaleFactor = void 0;
            var windowWidth = window.innerWidth;
            var windowHeight = window.innerHeight;
            var btnRect = this.el.getBoundingClientRect();
            var backdrop = $('<div class="fab-backdrop"></div>');
            var fabColor = this.$anchor.css('background-color');
            this.$anchor.append(backdrop);

            this.offsetX = btnRect.left - windowWidth / 2 + btnRect.width / 2;
            this.offsetY = windowHeight - btnRect.bottom;
            scaleFactor = windowWidth / backdrop[0].clientWidth;
            this.btnBottom = btnRect.bottom;
            this.btnLeft = btnRect.left;
            this.btnWidth = btnRect.width;

            // Set initial state
            this.$el.addClass('active');
            this.$el.css({
              'text-align': 'center',
              width: '100%',
              bottom: 0,
              left: 0,
              transform: 'translateX(' + this.offsetX + 'px)',
              transition: 'none'
            });
            this.$anchor.css({
              transform: 'translateY(' + -this.offsetY + 'px)',
              transition: 'none'
            });
            backdrop.css({
              'background-color': fabColor
            });

            setTimeout(function () {
              _this51.$el.css({
                transform: '',
                transition: 'transform .2s cubic-bezier(0.550, 0.085, 0.680, 0.530), background-color 0s linear .2s'
              });
              _this51.$anchor.css({
                overflow: 'visible',
                transform: '',
                transition: 'transform .2s'
              });

              setTimeout(function () {
                _this51.$el.css({
                  overflow: 'hidden',
                  'background-color': fabColor
                });
                backdrop.css({
                  transform: 'scale(' + scaleFactor + ')',
                  transition: 'transform .2s cubic-bezier(0.550, 0.055, 0.675, 0.190)'
                });
                _this51.$menu.children('li').children('a').css({
                  opacity: 1
                });

                // Scroll to close.
                _this51._handleDocumentClickBound = _this51._handleDocumentClick.bind(_this51);
                window.addEventListener('scroll', _this51._handleCloseBound, true);
                document.body.addEventListener('click', _this51._handleDocumentClickBound, true);
              }, 100);
            }, 0);
          }

          /**
           * Toolbar transition Menu close
           */

        }, {
          key: "_animateOutToolbar",
          value: function _animateOutToolbar() {
            var _this52 = this;

            var windowWidth = window.innerWidth;
            var windowHeight = window.innerHeight;
            var backdrop = this.$el.find('.fab-backdrop');
            var fabColor = this.$anchor.css('background-color');

            this.offsetX = this.btnLeft - windowWidth / 2 + this.btnWidth / 2;
            this.offsetY = windowHeight - this.btnBottom;

            // Hide backdrop
            this.$el.removeClass('active');
            this.$el.css({
              'background-color': 'transparent',
              transition: 'none'
            });
            this.$anchor.css({
              transition: 'none'
            });
            backdrop.css({
              transform: 'scale(0)',
              'background-color': fabColor
            });
            this.$menu.children('li').children('a').css({
              opacity: ''
            });

            setTimeout(function () {
              backdrop.remove();

              // Set initial state.
              _this52.$el.css({
                'text-align': '',
                width: '',
                bottom: '',
                left: '',
                overflow: '',
                'background-color': '',
                transform: 'translate3d(' + -_this52.offsetX + 'px,0,0)'
              });
              _this52.$anchor.css({
                overflow: '',
                transform: 'translate3d(0,' + _this52.offsetY + 'px,0)'
              });

              setTimeout(function () {
                _this52.$el.css({
                  transform: 'translate3d(0,0,0)',
                  transition: 'transform .2s'
                });
                _this52.$anchor.css({
                  transform: 'translate3d(0,0,0)',
                  transition: 'transform .2s cubic-bezier(0.550, 0.055, 0.675, 0.190)'
                });
              }, 20);
            }, 200);
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(FloatingActionButton.__proto__ || Object.getPrototypeOf(FloatingActionButton), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_FloatingActionButton;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return FloatingActionButton;
      }(Component);

      M.FloatingActionButton = FloatingActionButton;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(FloatingActionButton, 'floatingActionButton', 'M_FloatingActionButton');
      }
    })(cash, M.anime);
    (function ($) {

      var _defaults = {
        // Close when date is selected
        autoClose: false,

        // the default output format for the input field value
        format: 'mmm dd, yyyy',

        // Used to create date object from current input string
        parse: null,

        // The initial date to view when first opened
        defaultDate: null,

        // Make the `defaultDate` the initial selected value
        setDefaultDate: false,

        disableWeekends: false,

        disableDayFn: null,

        // First day of week (0: Sunday, 1: Monday etc)
        firstDay: 0,

        // The earliest date that can be selected
        minDate: null,
        // Thelatest date that can be selected
        maxDate: null,

        // Number of years either side, or array of upper/lower range
        yearRange: 10,

        // used internally (don't config outside)
        minYear: 0,
        maxYear: 9999,
        minMonth: undefined,
        maxMonth: undefined,

        startRange: null,
        endRange: null,

        isRTL: false,

        // Render the month after year in the calendar title
        showMonthAfterYear: false,

        // Render days of the calendar grid that fall in the next or previous month
        showDaysInNextAndPreviousMonths: false,

        // Specify a DOM element to render the calendar in
        container: null,

        // Show clear button
        showClearBtn: false,

        // internationalization
        i18n: {
          cancel: 'Cancel',
          clear: 'Clear',
          done: 'Ok',
          previousMonth: '‹',
          nextMonth: '›',
          months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
          monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          weekdaysAbbrev: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
        },

        // events array
        events: [],

        // callback function
        onSelect: null,
        onOpen: null,
        onClose: null,
        onDraw: null
      };

      /**
       * @class
       *
       */

      var Datepicker = function (_Component15) {
        _inherits(Datepicker, _Component15);

        /**
         * Construct Datepicker instance and set up overlay
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Datepicker(el, options) {
          _classCallCheck(this, Datepicker);

          var _this53 = _possibleConstructorReturn(this, (Datepicker.__proto__ || Object.getPrototypeOf(Datepicker)).call(this, Datepicker, el, options));

          _this53.el.M_Datepicker = _this53;

          _this53.options = $.extend({}, Datepicker.defaults, options);

          // make sure i18n defaults are not lost when only few i18n option properties are passed
          if (!!options && options.hasOwnProperty('i18n') && typeof options.i18n === 'object') {
            _this53.options.i18n = $.extend({}, Datepicker.defaults.i18n, options.i18n);
          }

          // Remove time component from minDate and maxDate options
          if (_this53.options.minDate) _this53.options.minDate.setHours(0, 0, 0, 0);
          if (_this53.options.maxDate) _this53.options.maxDate.setHours(0, 0, 0, 0);

          _this53.id = M.guid();

          _this53._setupVariables();
          _this53._insertHTMLIntoDOM();
          _this53._setupModal();

          _this53._setupEventHandlers();

          if (!_this53.options.defaultDate) {
            _this53.options.defaultDate = new Date(Date.parse(_this53.el.value));
          }

          var defDate = _this53.options.defaultDate;
          if (Datepicker._isDate(defDate)) {
            if (_this53.options.setDefaultDate) {
              _this53.setDate(defDate, true);
              _this53.setInputValue();
            } else {
              _this53.gotoDate(defDate);
            }
          } else {
            _this53.gotoDate(new Date());
          }

          /**
           * Describes open/close state of datepicker
           * @type {Boolean}
           */
          _this53.isOpen = false;
          return _this53;
        }

        _createClass(Datepicker, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.modal.destroy();
            $(this.modalEl).remove();
            this.destroySelects();
            this.el.M_Datepicker = undefined;
          }
        }, {
          key: "destroySelects",
          value: function destroySelects() {
            var oldYearSelect = this.calendarEl.querySelector('.orig-select-year');
            if (oldYearSelect) {
              M.FormSelect.getInstance(oldYearSelect).destroy();
            }
            var oldMonthSelect = this.calendarEl.querySelector('.orig-select-month');
            if (oldMonthSelect) {
              M.FormSelect.getInstance(oldMonthSelect).destroy();
            }
          }
        }, {
          key: "_insertHTMLIntoDOM",
          value: function _insertHTMLIntoDOM() {
            if (this.options.showClearBtn) {
              $(this.clearBtn).css({ visibility: '' });
              this.clearBtn.innerHTML = this.options.i18n.clear;
            }

            this.doneBtn.innerHTML = this.options.i18n.done;
            this.cancelBtn.innerHTML = this.options.i18n.cancel;

            if (this.options.container) {
              this.$modalEl.appendTo(this.options.container);
            } else {
              this.$modalEl.insertBefore(this.el);
            }
          }
        }, {
          key: "_setupModal",
          value: function _setupModal() {
            var _this54 = this;

            this.modalEl.id = 'modal-' + this.id;
            this.modal = M.Modal.init(this.modalEl, {
              onCloseEnd: function () {
                _this54.isOpen = false;
              }
            });
          }
        }, {
          key: "toString",
          value: function toString(format) {
            var _this55 = this;

            format = format || this.options.format;
            if (!Datepicker._isDate(this.date)) {
              return '';
            }

            var formatArray = format.split(/(d{1,4}|m{1,4}|y{4}|yy|!.)/g);
            var formattedDate = formatArray.map(function (label) {
              if (_this55.formats[label]) {
                return _this55.formats[label]();
              }

              return label;
            }).join('');
            return formattedDate;
          }
        }, {
          key: "setDate",
          value: function setDate(date, preventOnSelect) {
            if (!date) {
              this.date = null;
              this._renderDateDisplay();
              return this.draw();
            }
            if (typeof date === 'string') {
              date = new Date(Date.parse(date));
            }
            if (!Datepicker._isDate(date)) {
              return;
            }

            var min = this.options.minDate,
                max = this.options.maxDate;

            if (Datepicker._isDate(min) && date < min) {
              date = min;
            } else if (Datepicker._isDate(max) && date > max) {
              date = max;
            }

            this.date = new Date(date.getTime());

            this._renderDateDisplay();

            Datepicker._setToStartOfDay(this.date);
            this.gotoDate(this.date);

            if (!preventOnSelect && typeof this.options.onSelect === 'function') {
              this.options.onSelect.call(this, this.date);
            }
          }
        }, {
          key: "setInputValue",
          value: function setInputValue() {
            this.el.value = this.toString();
            this.$el.trigger('change', { firedBy: this });
          }
        }, {
          key: "_renderDateDisplay",
          value: function _renderDateDisplay() {
            var displayDate = Datepicker._isDate(this.date) ? this.date : new Date();
            var i18n = this.options.i18n;
            var day = i18n.weekdaysShort[displayDate.getDay()];
            var month = i18n.monthsShort[displayDate.getMonth()];
            var date = displayDate.getDate();
            this.yearTextEl.innerHTML = displayDate.getFullYear();
            this.dateTextEl.innerHTML = day + ", " + month + " " + date;
          }

          /**
           * change view to a specific date
           */

        }, {
          key: "gotoDate",
          value: function gotoDate(date) {
            var newCalendar = true;

            if (!Datepicker._isDate(date)) {
              return;
            }

            if (this.calendars) {
              var firstVisibleDate = new Date(this.calendars[0].year, this.calendars[0].month, 1),
                  lastVisibleDate = new Date(this.calendars[this.calendars.length - 1].year, this.calendars[this.calendars.length - 1].month, 1),
                  visibleDate = date.getTime();
              // get the end of the month
              lastVisibleDate.setMonth(lastVisibleDate.getMonth() + 1);
              lastVisibleDate.setDate(lastVisibleDate.getDate() - 1);
              newCalendar = visibleDate < firstVisibleDate.getTime() || lastVisibleDate.getTime() < visibleDate;
            }

            if (newCalendar) {
              this.calendars = [{
                month: date.getMonth(),
                year: date.getFullYear()
              }];
            }

            this.adjustCalendars();
          }
        }, {
          key: "adjustCalendars",
          value: function adjustCalendars() {
            this.calendars[0] = this.adjustCalendar(this.calendars[0]);
            this.draw();
          }
        }, {
          key: "adjustCalendar",
          value: function adjustCalendar(calendar) {
            if (calendar.month < 0) {
              calendar.year -= Math.ceil(Math.abs(calendar.month) / 12);
              calendar.month += 12;
            }
            if (calendar.month > 11) {
              calendar.year += Math.floor(Math.abs(calendar.month) / 12);
              calendar.month -= 12;
            }
            return calendar;
          }
        }, {
          key: "nextMonth",
          value: function nextMonth() {
            this.calendars[0].month++;
            this.adjustCalendars();
          }
        }, {
          key: "prevMonth",
          value: function prevMonth() {
            this.calendars[0].month--;
            this.adjustCalendars();
          }
        }, {
          key: "render",
          value: function render(year, month, randId) {
            var opts = this.options,
                now = new Date(),
                days = Datepicker._getDaysInMonth(year, month),
                before = new Date(year, month, 1).getDay(),
                data = [],
                row = [];
            Datepicker._setToStartOfDay(now);
            if (opts.firstDay > 0) {
              before -= opts.firstDay;
              if (before < 0) {
                before += 7;
              }
            }
            var previousMonth = month === 0 ? 11 : month - 1,
                nextMonth = month === 11 ? 0 : month + 1,
                yearOfPreviousMonth = month === 0 ? year - 1 : year,
                yearOfNextMonth = month === 11 ? year + 1 : year,
                daysInPreviousMonth = Datepicker._getDaysInMonth(yearOfPreviousMonth, previousMonth);
            var cells = days + before,
                after = cells;
            while (after > 7) {
              after -= 7;
            }
            cells += 7 - after;
            var isWeekSelected = false;
            for (var i = 0, r = 0; i < cells; i++) {
              var day = new Date(year, month, 1 + (i - before)),
                  isSelected = Datepicker._isDate(this.date) ? Datepicker._compareDates(day, this.date) : false,
                  isToday = Datepicker._compareDates(day, now),
                  hasEvent = opts.events.indexOf(day.toDateString()) !== -1 ? true : false,
                  isEmpty = i < before || i >= days + before,
                  dayNumber = 1 + (i - before),
                  monthNumber = month,
                  yearNumber = year,
                  isStartRange = opts.startRange && Datepicker._compareDates(opts.startRange, day),
                  isEndRange = opts.endRange && Datepicker._compareDates(opts.endRange, day),
                  isInRange = opts.startRange && opts.endRange && opts.startRange < day && day < opts.endRange,
                  isDisabled = opts.minDate && day < opts.minDate || opts.maxDate && day > opts.maxDate || opts.disableWeekends && Datepicker._isWeekend(day) || opts.disableDayFn && opts.disableDayFn(day);

              if (isEmpty) {
                if (i < before) {
                  dayNumber = daysInPreviousMonth + dayNumber;
                  monthNumber = previousMonth;
                  yearNumber = yearOfPreviousMonth;
                } else {
                  dayNumber = dayNumber - days;
                  monthNumber = nextMonth;
                  yearNumber = yearOfNextMonth;
                }
              }

              var dayConfig = {
                day: dayNumber,
                month: monthNumber,
                year: yearNumber,
                hasEvent: hasEvent,
                isSelected: isSelected,
                isToday: isToday,
                isDisabled: isDisabled,
                isEmpty: isEmpty,
                isStartRange: isStartRange,
                isEndRange: isEndRange,
                isInRange: isInRange,
                showDaysInNextAndPreviousMonths: opts.showDaysInNextAndPreviousMonths
              };

              row.push(this.renderDay(dayConfig));

              if (++r === 7) {
                data.push(this.renderRow(row, opts.isRTL, isWeekSelected));
                row = [];
                r = 0;
                isWeekSelected = false;
              }
            }
            return this.renderTable(opts, data, randId);
          }
        }, {
          key: "renderDay",
          value: function renderDay(opts) {
            var arr = [];
            var ariaSelected = 'false';
            if (opts.isEmpty) {
              if (opts.showDaysInNextAndPreviousMonths) {
                arr.push('is-outside-current-month');
                arr.push('is-selection-disabled');
              } else {
                return '<td class="is-empty"></td>';
              }
            }
            if (opts.isDisabled) {
              arr.push('is-disabled');
            }

            if (opts.isToday) {
              arr.push('is-today');
            }
            if (opts.isSelected) {
              arr.push('is-selected');
              ariaSelected = 'true';
            }
            if (opts.hasEvent) {
              arr.push('has-event');
            }
            if (opts.isInRange) {
              arr.push('is-inrange');
            }
            if (opts.isStartRange) {
              arr.push('is-startrange');
            }
            if (opts.isEndRange) {
              arr.push('is-endrange');
            }
            return "<td data-day=\"" + opts.day + "\" class=\"" + arr.join(' ') + "\" aria-selected=\"" + ariaSelected + "\">" + ("<button class=\"datepicker-day-button\" type=\"button\" data-year=\"" + opts.year + "\" data-month=\"" + opts.month + "\" data-day=\"" + opts.day + "\">" + opts.day + "</button>") + '</td>';
          }
        }, {
          key: "renderRow",
          value: function renderRow(days, isRTL, isRowSelected) {
            return '<tr class="datepicker-row' + (isRowSelected ? ' is-selected' : '') + '">' + (isRTL ? days.reverse() : days).join('') + '</tr>';
          }
        }, {
          key: "renderTable",
          value: function renderTable(opts, data, randId) {
            return '<div class="datepicker-table-wrapper"><table cellpadding="0" cellspacing="0" class="datepicker-table" role="grid" aria-labelledby="' + randId + '">' + this.renderHead(opts) + this.renderBody(data) + '</table></div>';
          }
        }, {
          key: "renderHead",
          value: function renderHead(opts) {
            var i = void 0,
                arr = [];
            for (i = 0; i < 7; i++) {
              arr.push("<th scope=\"col\"><abbr title=\"" + this.renderDayName(opts, i) + "\">" + this.renderDayName(opts, i, true) + "</abbr></th>");
            }
            return '<thead><tr>' + (opts.isRTL ? arr.reverse() : arr).join('') + '</tr></thead>';
          }
        }, {
          key: "renderBody",
          value: function renderBody(rows) {
            return '<tbody>' + rows.join('') + '</tbody>';
          }
        }, {
          key: "renderTitle",
          value: function renderTitle(instance, c, year, month, refYear, randId) {
            var i = void 0,
                j = void 0,
                arr = void 0,
                opts = this.options,
                isMinYear = year === opts.minYear,
                isMaxYear = year === opts.maxYear,
                html = '<div id="' + randId + '" class="datepicker-controls" role="heading" aria-live="assertive">',
                monthHtml = void 0,
                yearHtml = void 0,
                prev = true,
                next = true;

            for (arr = [], i = 0; i < 12; i++) {
              arr.push('<option value="' + (year === refYear ? i - c : 12 + i - c) + '"' + (i === month ? ' selected="selected"' : '') + (isMinYear && i < opts.minMonth || isMaxYear && i > opts.maxMonth ? 'disabled="disabled"' : '') + '>' + opts.i18n.months[i] + '</option>');
            }

            monthHtml = '<select class="datepicker-select orig-select-month" tabindex="-1">' + arr.join('') + '</select>';

            if ($.isArray(opts.yearRange)) {
              i = opts.yearRange[0];
              j = opts.yearRange[1] + 1;
            } else {
              i = year - opts.yearRange;
              j = 1 + year + opts.yearRange;
            }

            for (arr = []; i < j && i <= opts.maxYear; i++) {
              if (i >= opts.minYear) {
                arr.push("<option value=\"" + i + "\" " + (i === year ? 'selected="selected"' : '') + ">" + i + "</option>");
              }
            }

            yearHtml = "<select class=\"datepicker-select orig-select-year\" tabindex=\"-1\">" + arr.join('') + "</select>";

            var leftArrow = '<svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"/><path d="M0-.5h24v24H0z" fill="none"/></svg>';
            html += "<button class=\"month-prev" + (prev ? '' : ' is-disabled') + "\" type=\"button\">" + leftArrow + "</button>";

            html += '<div class="selects-container">';
            if (opts.showMonthAfterYear) {
              html += yearHtml + monthHtml;
            } else {
              html += monthHtml + yearHtml;
            }
            html += '</div>';

            if (isMinYear && (month === 0 || opts.minMonth >= month)) {
              prev = false;
            }

            if (isMaxYear && (month === 11 || opts.maxMonth <= month)) {
              next = false;
            }

            var rightArrow = '<svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"/><path d="M0-.25h24v24H0z" fill="none"/></svg>';
            html += "<button class=\"month-next" + (next ? '' : ' is-disabled') + "\" type=\"button\">" + rightArrow + "</button>";

            return html += '</div>';
          }

          /**
           * refresh the HTML
           */

        }, {
          key: "draw",
          value: function draw(force) {
            if (!this.isOpen && !force) {
              return;
            }
            var opts = this.options,
                minYear = opts.minYear,
                maxYear = opts.maxYear,
                minMonth = opts.minMonth,
                maxMonth = opts.maxMonth,
                html = '',
                randId = void 0;

            if (this._y <= minYear) {
              this._y = minYear;
              if (!isNaN(minMonth) && this._m < minMonth) {
                this._m = minMonth;
              }
            }
            if (this._y >= maxYear) {
              this._y = maxYear;
              if (!isNaN(maxMonth) && this._m > maxMonth) {
                this._m = maxMonth;
              }
            }

            randId = 'datepicker-title-' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 2);

            for (var c = 0; c < 1; c++) {
              this._renderDateDisplay();
              html += this.renderTitle(this, c, this.calendars[c].year, this.calendars[c].month, this.calendars[0].year, randId) + this.render(this.calendars[c].year, this.calendars[c].month, randId);
            }

            this.destroySelects();

            this.calendarEl.innerHTML = html;

            // Init Materialize Select
            var yearSelect = this.calendarEl.querySelector('.orig-select-year');
            var monthSelect = this.calendarEl.querySelector('.orig-select-month');
            M.FormSelect.init(yearSelect, {
              classes: 'select-year',
              dropdownOptions: { container: document.body, constrainWidth: false }
            });
            M.FormSelect.init(monthSelect, {
              classes: 'select-month',
              dropdownOptions: { container: document.body, constrainWidth: false }
            });

            // Add change handlers for select
            yearSelect.addEventListener('change', this._handleYearChange.bind(this));
            monthSelect.addEventListener('change', this._handleMonthChange.bind(this));

            if (typeof this.options.onDraw === 'function') {
              this.options.onDraw(this);
            }
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
            this._handleInputClickBound = this._handleInputClick.bind(this);
            this._handleInputChangeBound = this._handleInputChange.bind(this);
            this._handleCalendarClickBound = this._handleCalendarClick.bind(this);
            this._finishSelectionBound = this._finishSelection.bind(this);
            this._handleMonthChange = this._handleMonthChange.bind(this);
            this._closeBound = this.close.bind(this);

            this.el.addEventListener('click', this._handleInputClickBound);
            this.el.addEventListener('keydown', this._handleInputKeydownBound);
            this.el.addEventListener('change', this._handleInputChangeBound);
            this.calendarEl.addEventListener('click', this._handleCalendarClickBound);
            this.doneBtn.addEventListener('click', this._finishSelectionBound);
            this.cancelBtn.addEventListener('click', this._closeBound);

            if (this.options.showClearBtn) {
              this._handleClearClickBound = this._handleClearClick.bind(this);
              this.clearBtn.addEventListener('click', this._handleClearClickBound);
            }
          }
        }, {
          key: "_setupVariables",
          value: function _setupVariables() {
            var _this56 = this;

            this.$modalEl = $(Datepicker._template);
            this.modalEl = this.$modalEl[0];

            this.calendarEl = this.modalEl.querySelector('.datepicker-calendar');

            this.yearTextEl = this.modalEl.querySelector('.year-text');
            this.dateTextEl = this.modalEl.querySelector('.date-text');
            if (this.options.showClearBtn) {
              this.clearBtn = this.modalEl.querySelector('.datepicker-clear');
            }
            this.doneBtn = this.modalEl.querySelector('.datepicker-done');
            this.cancelBtn = this.modalEl.querySelector('.datepicker-cancel');

            this.formats = {
              d: function () {
                return _this56.date.getDate();
              },
              dd: function () {
                var d = _this56.date.getDate();
                return (d < 10 ? '0' : '') + d;
              },
              ddd: function () {
                return _this56.options.i18n.weekdaysShort[_this56.date.getDay()];
              },
              dddd: function () {
                return _this56.options.i18n.weekdays[_this56.date.getDay()];
              },
              m: function () {
                return _this56.date.getMonth() + 1;
              },
              mm: function () {
                var m = _this56.date.getMonth() + 1;
                return (m < 10 ? '0' : '') + m;
              },
              mmm: function () {
                return _this56.options.i18n.monthsShort[_this56.date.getMonth()];
              },
              mmmm: function () {
                return _this56.options.i18n.months[_this56.date.getMonth()];
              },
              yy: function () {
                return ('' + _this56.date.getFullYear()).slice(2);
              },
              yyyy: function () {
                return _this56.date.getFullYear();
              }
            };
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('click', this._handleInputClickBound);
            this.el.removeEventListener('keydown', this._handleInputKeydownBound);
            this.el.removeEventListener('change', this._handleInputChangeBound);
            this.calendarEl.removeEventListener('click', this._handleCalendarClickBound);
          }
        }, {
          key: "_handleInputClick",
          value: function _handleInputClick() {
            this.open();
          }
        }, {
          key: "_handleInputKeydown",
          value: function _handleInputKeydown(e) {
            if (e.which === M.keys.ENTER) {
              e.preventDefault();
              this.open();
            }
          }
        }, {
          key: "_handleCalendarClick",
          value: function _handleCalendarClick(e) {
            if (!this.isOpen) {
              return;
            }

            var $target = $(e.target);
            if (!$target.hasClass('is-disabled')) {
              if ($target.hasClass('datepicker-day-button') && !$target.hasClass('is-empty') && !$target.parent().hasClass('is-disabled')) {
                this.setDate(new Date(e.target.getAttribute('data-year'), e.target.getAttribute('data-month'), e.target.getAttribute('data-day')));
                if (this.options.autoClose) {
                  this._finishSelection();
                }
              } else if ($target.closest('.month-prev').length) {
                this.prevMonth();
              } else if ($target.closest('.month-next').length) {
                this.nextMonth();
              }
            }
          }
        }, {
          key: "_handleClearClick",
          value: function _handleClearClick() {
            this.date = null;
            this.setInputValue();
            this.close();
          }
        }, {
          key: "_handleMonthChange",
          value: function _handleMonthChange(e) {
            this.gotoMonth(e.target.value);
          }
        }, {
          key: "_handleYearChange",
          value: function _handleYearChange(e) {
            this.gotoYear(e.target.value);
          }

          /**
           * change view to a specific month (zero-index, e.g. 0: January)
           */

        }, {
          key: "gotoMonth",
          value: function gotoMonth(month) {
            if (!isNaN(month)) {
              this.calendars[0].month = parseInt(month, 10);
              this.adjustCalendars();
            }
          }

          /**
           * change view to a specific full year (e.g. "2012")
           */

        }, {
          key: "gotoYear",
          value: function gotoYear(year) {
            if (!isNaN(year)) {
              this.calendars[0].year = parseInt(year, 10);
              this.adjustCalendars();
            }
          }
        }, {
          key: "_handleInputChange",
          value: function _handleInputChange(e) {
            var date = void 0;

            // Prevent change event from being fired when triggered by the plugin
            if (e.firedBy === this) {
              return;
            }
            if (this.options.parse) {
              date = this.options.parse(this.el.value, this.options.format);
            } else {
              date = new Date(Date.parse(this.el.value));
            }

            if (Datepicker._isDate(date)) {
              this.setDate(date);
            }
          }
        }, {
          key: "renderDayName",
          value: function renderDayName(opts, day, abbr) {
            day += opts.firstDay;
            while (day >= 7) {
              day -= 7;
            }
            return abbr ? opts.i18n.weekdaysAbbrev[day] : opts.i18n.weekdays[day];
          }

          /**
           * Set input value to the selected date and close Datepicker
           */

        }, {
          key: "_finishSelection",
          value: function _finishSelection() {
            this.setInputValue();
            this.close();
          }

          /**
           * Open Datepicker
           */

        }, {
          key: "open",
          value: function open() {
            if (this.isOpen) {
              return;
            }

            this.isOpen = true;
            if (typeof this.options.onOpen === 'function') {
              this.options.onOpen.call(this);
            }
            this.draw();
            this.modal.open();
            return this;
          }

          /**
           * Close Datepicker
           */

        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }

            this.isOpen = false;
            if (typeof this.options.onClose === 'function') {
              this.options.onClose.call(this);
            }
            this.modal.close();
            return this;
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Datepicker.__proto__ || Object.getPrototypeOf(Datepicker), "init", this).call(this, this, els, options);
          }
        }, {
          key: "_isDate",
          value: function _isDate(obj) {
            return (/Date/.test(Object.prototype.toString.call(obj)) && !isNaN(obj.getTime())
            );
          }
        }, {
          key: "_isWeekend",
          value: function _isWeekend(date) {
            var day = date.getDay();
            return day === 0 || day === 6;
          }
        }, {
          key: "_setToStartOfDay",
          value: function _setToStartOfDay(date) {
            if (Datepicker._isDate(date)) date.setHours(0, 0, 0, 0);
          }
        }, {
          key: "_getDaysInMonth",
          value: function _getDaysInMonth(year, month) {
            return [31, Datepicker._isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
          }
        }, {
          key: "_isLeapYear",
          value: function _isLeapYear(year) {
            // solution by Matti Virkkunen: http://stackoverflow.com/a/4881951
            return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
          }
        }, {
          key: "_compareDates",
          value: function _compareDates(a, b) {
            // weak date comparison (use setToStartOfDay(date) to ensure correct result)
            return a.getTime() === b.getTime();
          }
        }, {
          key: "_setToStartOfDay",
          value: function _setToStartOfDay(date) {
            if (Datepicker._isDate(date)) date.setHours(0, 0, 0, 0);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Datepicker;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Datepicker;
      }(Component);

      Datepicker._template = ['<div class= "modal datepicker-modal">', '<div class="modal-content datepicker-container">', '<div class="datepicker-date-display">', '<span class="year-text"></span>', '<span class="date-text"></span>', '</div>', '<div class="datepicker-calendar-container">', '<div class="datepicker-calendar"></div>', '<div class="datepicker-footer">', '<button class="btn-flat datepicker-clear waves-effect" style="visibility: hidden;" type="button"></button>', '<div class="confirmation-btns">', '<button class="btn-flat datepicker-cancel waves-effect" type="button"></button>', '<button class="btn-flat datepicker-done waves-effect" type="button"></button>', '</div>', '</div>', '</div>', '</div>', '</div>'].join('');

      M.Datepicker = Datepicker;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Datepicker, 'datepicker', 'M_Datepicker');
      }
    })(cash);
    (function ($) {

      var _defaults = {
        dialRadius: 135,
        outerRadius: 105,
        innerRadius: 70,
        tickRadius: 20,
        duration: 350,
        container: null,
        defaultTime: 'now', // default time, 'now' or '13:14' e.g.
        fromNow: 0, // Millisecond offset from the defaultTime
        showClearBtn: false,

        // internationalization
        i18n: {
          cancel: 'Cancel',
          clear: 'Clear',
          done: 'Ok'
        },

        autoClose: false, // auto close when minute is selected
        twelveHour: true, // change to 12 hour AM/PM clock from 24 hour
        vibrate: true, // vibrate the device when dragging clock hand

        // Callbacks
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        onSelect: null
      };

      /**
       * @class
       *
       */

      var Timepicker = function (_Component16) {
        _inherits(Timepicker, _Component16);

        function Timepicker(el, options) {
          _classCallCheck(this, Timepicker);

          var _this57 = _possibleConstructorReturn(this, (Timepicker.__proto__ || Object.getPrototypeOf(Timepicker)).call(this, Timepicker, el, options));

          _this57.el.M_Timepicker = _this57;

          _this57.options = $.extend({}, Timepicker.defaults, options);

          _this57.id = M.guid();
          _this57._insertHTMLIntoDOM();
          _this57._setupModal();
          _this57._setupVariables();
          _this57._setupEventHandlers();

          _this57._clockSetup();
          _this57._pickerSetup();
          return _this57;
        }

        _createClass(Timepicker, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.modal.destroy();
            $(this.modalEl).remove();
            this.el.M_Timepicker = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
            this._handleInputClickBound = this._handleInputClick.bind(this);
            this._handleClockClickStartBound = this._handleClockClickStart.bind(this);
            this._handleDocumentClickMoveBound = this._handleDocumentClickMove.bind(this);
            this._handleDocumentClickEndBound = this._handleDocumentClickEnd.bind(this);

            this.el.addEventListener('click', this._handleInputClickBound);
            this.el.addEventListener('keydown', this._handleInputKeydownBound);
            this.plate.addEventListener('mousedown', this._handleClockClickStartBound);
            this.plate.addEventListener('touchstart', this._handleClockClickStartBound);

            $(this.spanHours).on('click', this.showView.bind(this, 'hours'));
            $(this.spanMinutes).on('click', this.showView.bind(this, 'minutes'));
          }
        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('click', this._handleInputClickBound);
            this.el.removeEventListener('keydown', this._handleInputKeydownBound);
          }
        }, {
          key: "_handleInputClick",
          value: function _handleInputClick() {
            this.open();
          }
        }, {
          key: "_handleInputKeydown",
          value: function _handleInputKeydown(e) {
            if (e.which === M.keys.ENTER) {
              e.preventDefault();
              this.open();
            }
          }
        }, {
          key: "_handleClockClickStart",
          value: function _handleClockClickStart(e) {
            e.preventDefault();
            var clockPlateBR = this.plate.getBoundingClientRect();
            var offset = { x: clockPlateBR.left, y: clockPlateBR.top };

            this.x0 = offset.x + this.options.dialRadius;
            this.y0 = offset.y + this.options.dialRadius;
            this.moved = false;
            var clickPos = Timepicker._Pos(e);
            this.dx = clickPos.x - this.x0;
            this.dy = clickPos.y - this.y0;

            // Set clock hands
            this.setHand(this.dx, this.dy, false);

            // Mousemove on document
            document.addEventListener('mousemove', this._handleDocumentClickMoveBound);
            document.addEventListener('touchmove', this._handleDocumentClickMoveBound);

            // Mouseup on document
            document.addEventListener('mouseup', this._handleDocumentClickEndBound);
            document.addEventListener('touchend', this._handleDocumentClickEndBound);
          }
        }, {
          key: "_handleDocumentClickMove",
          value: function _handleDocumentClickMove(e) {
            e.preventDefault();
            var clickPos = Timepicker._Pos(e);
            var x = clickPos.x - this.x0;
            var y = clickPos.y - this.y0;
            this.moved = true;
            this.setHand(x, y, false, true);
          }
        }, {
          key: "_handleDocumentClickEnd",
          value: function _handleDocumentClickEnd(e) {
            var _this58 = this;

            e.preventDefault();
            document.removeEventListener('mouseup', this._handleDocumentClickEndBound);
            document.removeEventListener('touchend', this._handleDocumentClickEndBound);
            var clickPos = Timepicker._Pos(e);
            var x = clickPos.x - this.x0;
            var y = clickPos.y - this.y0;
            if (this.moved && x === this.dx && y === this.dy) {
              this.setHand(x, y);
            }

            if (this.currentView === 'hours') {
              this.showView('minutes', this.options.duration / 2);
            } else if (this.options.autoClose) {
              $(this.minutesView).addClass('timepicker-dial-out');
              setTimeout(function () {
                _this58.done();
              }, this.options.duration / 2);
            }

            if (typeof this.options.onSelect === 'function') {
              this.options.onSelect.call(this, this.hours, this.minutes);
            }

            // Unbind mousemove event
            document.removeEventListener('mousemove', this._handleDocumentClickMoveBound);
            document.removeEventListener('touchmove', this._handleDocumentClickMoveBound);
          }
        }, {
          key: "_insertHTMLIntoDOM",
          value: function _insertHTMLIntoDOM() {
            this.$modalEl = $(Timepicker._template);
            this.modalEl = this.$modalEl[0];
            this.modalEl.id = 'modal-' + this.id;

            // Append popover to input by default
            var containerEl = document.querySelector(this.options.container);
            if (this.options.container && !!containerEl) {
              this.$modalEl.appendTo(containerEl);
            } else {
              this.$modalEl.insertBefore(this.el);
            }
          }
        }, {
          key: "_setupModal",
          value: function _setupModal() {
            var _this59 = this;

            this.modal = M.Modal.init(this.modalEl, {
              onOpenStart: this.options.onOpenStart,
              onOpenEnd: this.options.onOpenEnd,
              onCloseStart: this.options.onCloseStart,
              onCloseEnd: function () {
                if (typeof _this59.options.onCloseEnd === 'function') {
                  _this59.options.onCloseEnd.call(_this59);
                }
                _this59.isOpen = false;
              }
            });
          }
        }, {
          key: "_setupVariables",
          value: function _setupVariables() {
            this.currentView = 'hours';
            this.vibrate = navigator.vibrate ? 'vibrate' : navigator.webkitVibrate ? 'webkitVibrate' : null;

            this._canvas = this.modalEl.querySelector('.timepicker-canvas');
            this.plate = this.modalEl.querySelector('.timepicker-plate');

            this.hoursView = this.modalEl.querySelector('.timepicker-hours');
            this.minutesView = this.modalEl.querySelector('.timepicker-minutes');
            this.spanHours = this.modalEl.querySelector('.timepicker-span-hours');
            this.spanMinutes = this.modalEl.querySelector('.timepicker-span-minutes');
            this.spanAmPm = this.modalEl.querySelector('.timepicker-span-am-pm');
            this.footer = this.modalEl.querySelector('.timepicker-footer');
            this.amOrPm = 'PM';
          }
        }, {
          key: "_pickerSetup",
          value: function _pickerSetup() {
            var $clearBtn = $("<button class=\"btn-flat timepicker-clear waves-effect\" style=\"visibility: hidden;\" type=\"button\" tabindex=\"" + (this.options.twelveHour ? '3' : '1') + "\">" + this.options.i18n.clear + "</button>").appendTo(this.footer).on('click', this.clear.bind(this));
            if (this.options.showClearBtn) {
              $clearBtn.css({ visibility: '' });
            }

            var confirmationBtnsContainer = $('<div class="confirmation-btns"></div>');
            $('<button class="btn-flat timepicker-close waves-effect" type="button" tabindex="' + (this.options.twelveHour ? '3' : '1') + '">' + this.options.i18n.cancel + '</button>').appendTo(confirmationBtnsContainer).on('click', this.close.bind(this));
            $('<button class="btn-flat timepicker-close waves-effect" type="button" tabindex="' + (this.options.twelveHour ? '3' : '1') + '">' + this.options.i18n.done + '</button>').appendTo(confirmationBtnsContainer).on('click', this.done.bind(this));
            confirmationBtnsContainer.appendTo(this.footer);
          }
        }, {
          key: "_clockSetup",
          value: function _clockSetup() {
            if (this.options.twelveHour) {
              this.$amBtn = $('<div class="am-btn">AM</div>');
              this.$pmBtn = $('<div class="pm-btn">PM</div>');
              this.$amBtn.on('click', this._handleAmPmClick.bind(this)).appendTo(this.spanAmPm);
              this.$pmBtn.on('click', this._handleAmPmClick.bind(this)).appendTo(this.spanAmPm);
            }

            this._buildHoursView();
            this._buildMinutesView();
            this._buildSVGClock();
          }
        }, {
          key: "_buildSVGClock",
          value: function _buildSVGClock() {
            // Draw clock hands and others
            var dialRadius = this.options.dialRadius;
            var tickRadius = this.options.tickRadius;
            var diameter = dialRadius * 2;

            var svg = Timepicker._createSVGEl('svg');
            svg.setAttribute('class', 'timepicker-svg');
            svg.setAttribute('width', diameter);
            svg.setAttribute('height', diameter);
            var g = Timepicker._createSVGEl('g');
            g.setAttribute('transform', 'translate(' + dialRadius + ',' + dialRadius + ')');
            var bearing = Timepicker._createSVGEl('circle');
            bearing.setAttribute('class', 'timepicker-canvas-bearing');
            bearing.setAttribute('cx', 0);
            bearing.setAttribute('cy', 0);
            bearing.setAttribute('r', 4);
            var hand = Timepicker._createSVGEl('line');
            hand.setAttribute('x1', 0);
            hand.setAttribute('y1', 0);
            var bg = Timepicker._createSVGEl('circle');
            bg.setAttribute('class', 'timepicker-canvas-bg');
            bg.setAttribute('r', tickRadius);
            g.appendChild(hand);
            g.appendChild(bg);
            g.appendChild(bearing);
            svg.appendChild(g);
            this._canvas.appendChild(svg);

            this.hand = hand;
            this.bg = bg;
            this.bearing = bearing;
            this.g = g;
          }
        }, {
          key: "_buildHoursView",
          value: function _buildHoursView() {
            var $tick = $('<div class="timepicker-tick"></div>');
            // Hours view
            if (this.options.twelveHour) {
              for (var i = 1; i < 13; i += 1) {
                var tick = $tick.clone();
                var radian = i / 6 * Math.PI;
                var radius = this.options.outerRadius;
                tick.css({
                  left: this.options.dialRadius + Math.sin(radian) * radius - this.options.tickRadius + 'px',
                  top: this.options.dialRadius - Math.cos(radian) * radius - this.options.tickRadius + 'px'
                });
                tick.html(i === 0 ? '00' : i);
                this.hoursView.appendChild(tick[0]);
                // tick.on(mousedownEvent, mousedown);
              }
            } else {
              for (var _i2 = 0; _i2 < 24; _i2 += 1) {
                var _tick = $tick.clone();
                var _radian = _i2 / 6 * Math.PI;
                var inner = _i2 > 0 && _i2 < 13;
                var _radius = inner ? this.options.innerRadius : this.options.outerRadius;
                _tick.css({
                  left: this.options.dialRadius + Math.sin(_radian) * _radius - this.options.tickRadius + 'px',
                  top: this.options.dialRadius - Math.cos(_radian) * _radius - this.options.tickRadius + 'px'
                });
                _tick.html(_i2 === 0 ? '00' : _i2);
                this.hoursView.appendChild(_tick[0]);
                // tick.on(mousedownEvent, mousedown);
              }
            }
          }
        }, {
          key: "_buildMinutesView",
          value: function _buildMinutesView() {
            var $tick = $('<div class="timepicker-tick"></div>');
            // Minutes view
            for (var i = 0; i < 60; i += 5) {
              var tick = $tick.clone();
              var radian = i / 30 * Math.PI;
              tick.css({
                left: this.options.dialRadius + Math.sin(radian) * this.options.outerRadius - this.options.tickRadius + 'px',
                top: this.options.dialRadius - Math.cos(radian) * this.options.outerRadius - this.options.tickRadius + 'px'
              });
              tick.html(Timepicker._addLeadingZero(i));
              this.minutesView.appendChild(tick[0]);
            }
          }
        }, {
          key: "_handleAmPmClick",
          value: function _handleAmPmClick(e) {
            var $btnClicked = $(e.target);
            this.amOrPm = $btnClicked.hasClass('am-btn') ? 'AM' : 'PM';
            this._updateAmPmView();
          }
        }, {
          key: "_updateAmPmView",
          value: function _updateAmPmView() {
            if (this.options.twelveHour) {
              this.$amBtn.toggleClass('text-primary', this.amOrPm === 'AM');
              this.$pmBtn.toggleClass('text-primary', this.amOrPm === 'PM');
            }
          }
        }, {
          key: "_updateTimeFromInput",
          value: function _updateTimeFromInput() {
            // Get the time
            var value = ((this.el.value || this.options.defaultTime || '') + '').split(':');
            if (this.options.twelveHour && !(typeof value[1] === 'undefined')) {
              if (value[1].toUpperCase().indexOf('AM') > 0) {
                this.amOrPm = 'AM';
              } else {
                this.amOrPm = 'PM';
              }
              value[1] = value[1].replace('AM', '').replace('PM', '');
            }
            if (value[0] === 'now') {
              var now = new Date(+new Date() + this.options.fromNow);
              value = [now.getHours(), now.getMinutes()];
              if (this.options.twelveHour) {
                this.amOrPm = value[0] >= 12 && value[0] < 24 ? 'PM' : 'AM';
              }
            }
            this.hours = +value[0] || 0;
            this.minutes = +value[1] || 0;
            this.spanHours.innerHTML = this.hours;
            this.spanMinutes.innerHTML = Timepicker._addLeadingZero(this.minutes);

            this._updateAmPmView();
          }
        }, {
          key: "showView",
          value: function showView(view, delay) {
            if (view === 'minutes' && $(this.hoursView).css('visibility') === 'visible') ;
            var isHours = view === 'hours',
                nextView = isHours ? this.hoursView : this.minutesView,
                hideView = isHours ? this.minutesView : this.hoursView;
            this.currentView = view;

            $(this.spanHours).toggleClass('text-primary', isHours);
            $(this.spanMinutes).toggleClass('text-primary', !isHours);

            // Transition view
            hideView.classList.add('timepicker-dial-out');
            $(nextView).css('visibility', 'visible').removeClass('timepicker-dial-out');

            // Reset clock hand
            this.resetClock(delay);

            // After transitions ended
            clearTimeout(this.toggleViewTimer);
            this.toggleViewTimer = setTimeout(function () {
              $(hideView).css('visibility', 'hidden');
            }, this.options.duration);
          }
        }, {
          key: "resetClock",
          value: function resetClock(delay) {
            var view = this.currentView,
                value = this[view],
                isHours = view === 'hours',
                unit = Math.PI / (isHours ? 6 : 30),
                radian = value * unit,
                radius = isHours && value > 0 && value < 13 ? this.options.innerRadius : this.options.outerRadius,
                x = Math.sin(radian) * radius,
                y = -Math.cos(radian) * radius,
                self = this;

            if (delay) {
              $(this.canvas).addClass('timepicker-canvas-out');
              setTimeout(function () {
                $(self.canvas).removeClass('timepicker-canvas-out');
                self.setHand(x, y);
              }, delay);
            } else {
              this.setHand(x, y);
            }
          }
        }, {
          key: "setHand",
          value: function setHand(x, y, roundBy5) {
            var _this60 = this;

            var radian = Math.atan2(x, -y),
                isHours = this.currentView === 'hours',
                unit = Math.PI / (isHours || roundBy5 ? 6 : 30),
                z = Math.sqrt(x * x + y * y),
                inner = isHours && z < (this.options.outerRadius + this.options.innerRadius) / 2,
                radius = inner ? this.options.innerRadius : this.options.outerRadius;

            if (this.options.twelveHour) {
              radius = this.options.outerRadius;
            }

            // Radian should in range [0, 2PI]
            if (radian < 0) {
              radian = Math.PI * 2 + radian;
            }

            // Get the round value
            var value = Math.round(radian / unit);

            // Get the round radian
            radian = value * unit;

            // Correct the hours or minutes
            if (this.options.twelveHour) {
              if (isHours) {
                if (value === 0) value = 12;
              } else {
                if (roundBy5) value *= 5;
                if (value === 60) value = 0;
              }
            } else {
              if (isHours) {
                if (value === 12) {
                  value = 0;
                }
                value = inner ? value === 0 ? 12 : value : value === 0 ? 0 : value + 12;
              } else {
                if (roundBy5) {
                  value *= 5;
                }
                if (value === 60) {
                  value = 0;
                }
              }
            }

            // Once hours or minutes changed, vibrate the device
            if (this[this.currentView] !== value) {
              if (this.vibrate && this.options.vibrate) {
                // Do not vibrate too frequently
                if (!this.vibrateTimer) {
                  navigator[this.vibrate](10);
                  this.vibrateTimer = setTimeout(function () {
                    _this60.vibrateTimer = null;
                  }, 100);
                }
              }
            }

            this[this.currentView] = value;
            if (isHours) {
              this['spanHours'].innerHTML = value;
            } else {
              this['spanMinutes'].innerHTML = Timepicker._addLeadingZero(value);
            }

            // Set clock hand and others' position
            var cx1 = Math.sin(radian) * (radius - this.options.tickRadius),
                cy1 = -Math.cos(radian) * (radius - this.options.tickRadius),
                cx2 = Math.sin(radian) * radius,
                cy2 = -Math.cos(radian) * radius;
            this.hand.setAttribute('x2', cx1);
            this.hand.setAttribute('y2', cy1);
            this.bg.setAttribute('cx', cx2);
            this.bg.setAttribute('cy', cy2);
          }
        }, {
          key: "open",
          value: function open() {
            if (this.isOpen) {
              return;
            }

            this.isOpen = true;
            this._updateTimeFromInput();
            this.showView('hours');

            this.modal.open();
          }
        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }

            this.isOpen = false;
            this.modal.close();
          }

          /**
           * Finish timepicker selection.
           */

        }, {
          key: "done",
          value: function done(e, clearValue) {
            // Set input value
            var last = this.el.value;
            var value = clearValue ? '' : Timepicker._addLeadingZero(this.hours) + ':' + Timepicker._addLeadingZero(this.minutes);
            this.time = value;
            if (!clearValue && this.options.twelveHour) {
              value = value + " " + this.amOrPm;
            }
            this.el.value = value;

            // Trigger change event
            if (value !== last) {
              this.$el.trigger('change');
            }

            this.close();
            this.el.focus();
          }
        }, {
          key: "clear",
          value: function clear() {
            this.done(null, true);
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Timepicker.__proto__ || Object.getPrototypeOf(Timepicker), "init", this).call(this, this, els, options);
          }
        }, {
          key: "_addLeadingZero",
          value: function _addLeadingZero(num) {
            return (num < 10 ? '0' : '') + num;
          }
        }, {
          key: "_createSVGEl",
          value: function _createSVGEl(name) {
            var svgNS = 'http://www.w3.org/2000/svg';
            return document.createElementNS(svgNS, name);
          }

          /**
           * @typedef {Object} Point
           * @property {number} x The X Coordinate
           * @property {number} y The Y Coordinate
           */

          /**
           * Get x position of mouse or touch event
           * @param {Event} e
           * @return {Point} x and y location
           */

        }, {
          key: "_Pos",
          value: function _Pos(e) {
            if (e.targetTouches && e.targetTouches.length >= 1) {
              return { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
            }
            // mouse event
            return { x: e.clientX, y: e.clientY };
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Timepicker;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Timepicker;
      }(Component);

      Timepicker._template = ['<div class= "modal timepicker-modal">', '<div class="modal-content timepicker-container">', '<div class="timepicker-digital-display">', '<div class="timepicker-text-container">', '<div class="timepicker-display-column">', '<span class="timepicker-span-hours text-primary"></span>', ':', '<span class="timepicker-span-minutes"></span>', '</div>', '<div class="timepicker-display-column timepicker-display-am-pm">', '<div class="timepicker-span-am-pm"></div>', '</div>', '</div>', '</div>', '<div class="timepicker-analog-display">', '<div class="timepicker-plate">', '<div class="timepicker-canvas"></div>', '<div class="timepicker-dial timepicker-hours"></div>', '<div class="timepicker-dial timepicker-minutes timepicker-dial-out"></div>', '</div>', '<div class="timepicker-footer"></div>', '</div>', '</div>', '</div>'].join('');

      M.Timepicker = Timepicker;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Timepicker, 'timepicker', 'M_Timepicker');
      }
    })(cash);
    (function ($) {

      var _defaults = {};

      /**
       * @class
       *
       */

      var CharacterCounter = function (_Component17) {
        _inherits(CharacterCounter, _Component17);

        /**
         * Construct CharacterCounter instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function CharacterCounter(el, options) {
          _classCallCheck(this, CharacterCounter);

          var _this61 = _possibleConstructorReturn(this, (CharacterCounter.__proto__ || Object.getPrototypeOf(CharacterCounter)).call(this, CharacterCounter, el, options));

          _this61.el.M_CharacterCounter = _this61;

          /**
           * Options for the character counter
           */
          _this61.options = $.extend({}, CharacterCounter.defaults, options);

          _this61.isInvalid = false;
          _this61.isValidLength = false;
          _this61._setupCounter();
          _this61._setupEventHandlers();
          return _this61;
        }

        _createClass(CharacterCounter, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.el.CharacterCounter = undefined;
            this._removeCounter();
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleUpdateCounterBound = this.updateCounter.bind(this);

            this.el.addEventListener('focus', this._handleUpdateCounterBound, true);
            this.el.addEventListener('input', this._handleUpdateCounterBound, true);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('focus', this._handleUpdateCounterBound, true);
            this.el.removeEventListener('input', this._handleUpdateCounterBound, true);
          }

          /**
           * Setup counter element
           */

        }, {
          key: "_setupCounter",
          value: function _setupCounter() {
            this.counterEl = document.createElement('span');
            $(this.counterEl).addClass('character-counter').css({
              float: 'right',
              'font-size': '12px',
              height: 1
            });

            this.$el.parent().append(this.counterEl);
          }

          /**
           * Remove counter element
           */

        }, {
          key: "_removeCounter",
          value: function _removeCounter() {
            $(this.counterEl).remove();
          }

          /**
           * Update counter
           */

        }, {
          key: "updateCounter",
          value: function updateCounter() {
            var maxLength = +this.$el.attr('data-length'),
                actualLength = this.el.value.length;
            this.isValidLength = actualLength <= maxLength;
            var counterString = actualLength;

            if (maxLength) {
              counterString += '/' + maxLength;
              this._validateInput();
            }

            $(this.counterEl).html(counterString);
          }

          /**
           * Add validation classes
           */

        }, {
          key: "_validateInput",
          value: function _validateInput() {
            if (this.isValidLength && this.isInvalid) {
              this.isInvalid = false;
              this.$el.removeClass('invalid');
            } else if (!this.isValidLength && !this.isInvalid) {
              this.isInvalid = true;
              this.$el.removeClass('valid');
              this.$el.addClass('invalid');
            }
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(CharacterCounter.__proto__ || Object.getPrototypeOf(CharacterCounter), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_CharacterCounter;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return CharacterCounter;
      }(Component);

      M.CharacterCounter = CharacterCounter;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(CharacterCounter, 'characterCounter', 'M_CharacterCounter');
      }
    })(cash);
    (function ($) {

      var _defaults = {
        duration: 200, // ms
        dist: -100, // zoom scale TODO: make this more intuitive as an option
        shift: 0, // spacing for center image
        padding: 0, // Padding between non center items
        numVisible: 5, // Number of visible items in carousel
        fullWidth: false, // Change to full width styles
        indicators: false, // Toggle indicators
        noWrap: false, // Don't wrap around and cycle through items.
        onCycleTo: null // Callback for when a new slide is cycled to.
      };

      /**
       * @class
       *
       */

      var Carousel = function (_Component18) {
        _inherits(Carousel, _Component18);

        /**
         * Construct Carousel instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Carousel(el, options) {
          _classCallCheck(this, Carousel);

          var _this62 = _possibleConstructorReturn(this, (Carousel.__proto__ || Object.getPrototypeOf(Carousel)).call(this, Carousel, el, options));

          _this62.el.M_Carousel = _this62;

          /**
           * Options for the carousel
           * @member Carousel#options
           * @prop {Number} duration
           * @prop {Number} dist
           * @prop {Number} shift
           * @prop {Number} padding
           * @prop {Number} numVisible
           * @prop {Boolean} fullWidth
           * @prop {Boolean} indicators
           * @prop {Boolean} noWrap
           * @prop {Function} onCycleTo
           */
          _this62.options = $.extend({}, Carousel.defaults, options);

          // Setup
          _this62.hasMultipleSlides = _this62.$el.find('.carousel-item').length > 1;
          _this62.showIndicators = _this62.options.indicators && _this62.hasMultipleSlides;
          _this62.noWrap = _this62.options.noWrap || !_this62.hasMultipleSlides;
          _this62.pressed = false;
          _this62.dragged = false;
          _this62.offset = _this62.target = 0;
          _this62.images = [];
          _this62.itemWidth = _this62.$el.find('.carousel-item').first().innerWidth();
          _this62.itemHeight = _this62.$el.find('.carousel-item').first().innerHeight();
          _this62.dim = _this62.itemWidth * 2 + _this62.options.padding || 1; // Make sure dim is non zero for divisions.
          _this62._autoScrollBound = _this62._autoScroll.bind(_this62);
          _this62._trackBound = _this62._track.bind(_this62);

          // Full Width carousel setup
          if (_this62.options.fullWidth) {
            _this62.options.dist = 0;
            _this62._setCarouselHeight();

            // Offset fixed items when indicators.
            if (_this62.showIndicators) {
              _this62.$el.find('.carousel-fixed-item').addClass('with-indicators');
            }
          }

          // Iterate through slides
          _this62.$indicators = $('<ul class="indicators"></ul>');
          _this62.$el.find('.carousel-item').each(function (el, i) {
            _this62.images.push(el);
            if (_this62.showIndicators) {
              var $indicator = $('<li class="indicator-item"></li>');

              // Add active to first by default.
              if (i === 0) {
                $indicator[0].classList.add('active');
              }

              _this62.$indicators.append($indicator);
            }
          });
          if (_this62.showIndicators) {
            _this62.$el.append(_this62.$indicators);
          }
          _this62.count = _this62.images.length;

          // Cap numVisible at count
          _this62.options.numVisible = Math.min(_this62.count, _this62.options.numVisible);

          // Setup cross browser string
          _this62.xform = 'transform';
          ['webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
            var e = prefix + 'Transform';
            if (typeof document.body.style[e] !== 'undefined') {
              _this62.xform = e;
              return false;
            }
            return true;
          });

          _this62._setupEventHandlers();
          _this62._scroll(_this62.offset);
          return _this62;
        }

        _createClass(Carousel, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.el.M_Carousel = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            var _this63 = this;

            this._handleCarouselTapBound = this._handleCarouselTap.bind(this);
            this._handleCarouselDragBound = this._handleCarouselDrag.bind(this);
            this._handleCarouselReleaseBound = this._handleCarouselRelease.bind(this);
            this._handleCarouselClickBound = this._handleCarouselClick.bind(this);

            if (typeof window.ontouchstart !== 'undefined') {
              this.el.addEventListener('touchstart', this._handleCarouselTapBound);
              this.el.addEventListener('touchmove', this._handleCarouselDragBound);
              this.el.addEventListener('touchend', this._handleCarouselReleaseBound);
            }

            this.el.addEventListener('mousedown', this._handleCarouselTapBound);
            this.el.addEventListener('mousemove', this._handleCarouselDragBound);
            this.el.addEventListener('mouseup', this._handleCarouselReleaseBound);
            this.el.addEventListener('mouseleave', this._handleCarouselReleaseBound);
            this.el.addEventListener('click', this._handleCarouselClickBound);

            if (this.showIndicators && this.$indicators) {
              this._handleIndicatorClickBound = this._handleIndicatorClick.bind(this);
              this.$indicators.find('.indicator-item').each(function (el, i) {
                el.addEventListener('click', _this63._handleIndicatorClickBound);
              });
            }

            // Resize
            var throttledResize = M.throttle(this._handleResize, 200);
            this._handleThrottledResizeBound = throttledResize.bind(this);

            window.addEventListener('resize', this._handleThrottledResizeBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            var _this64 = this;

            if (typeof window.ontouchstart !== 'undefined') {
              this.el.removeEventListener('touchstart', this._handleCarouselTapBound);
              this.el.removeEventListener('touchmove', this._handleCarouselDragBound);
              this.el.removeEventListener('touchend', this._handleCarouselReleaseBound);
            }
            this.el.removeEventListener('mousedown', this._handleCarouselTapBound);
            this.el.removeEventListener('mousemove', this._handleCarouselDragBound);
            this.el.removeEventListener('mouseup', this._handleCarouselReleaseBound);
            this.el.removeEventListener('mouseleave', this._handleCarouselReleaseBound);
            this.el.removeEventListener('click', this._handleCarouselClickBound);

            if (this.showIndicators && this.$indicators) {
              this.$indicators.find('.indicator-item').each(function (el, i) {
                el.removeEventListener('click', _this64._handleIndicatorClickBound);
              });
            }

            window.removeEventListener('resize', this._handleThrottledResizeBound);
          }

          /**
           * Handle Carousel Tap
           * @param {Event} e
           */

        }, {
          key: "_handleCarouselTap",
          value: function _handleCarouselTap(e) {
            // Fixes firefox draggable image bug
            if (e.type === 'mousedown' && $(e.target).is('img')) {
              e.preventDefault();
            }
            this.pressed = true;
            this.dragged = false;
            this.verticalDragged = false;
            this.reference = this._xpos(e);
            this.referenceY = this._ypos(e);

            this.velocity = this.amplitude = 0;
            this.frame = this.offset;
            this.timestamp = Date.now();
            clearInterval(this.ticker);
            this.ticker = setInterval(this._trackBound, 100);
          }

          /**
           * Handle Carousel Drag
           * @param {Event} e
           */

        }, {
          key: "_handleCarouselDrag",
          value: function _handleCarouselDrag(e) {
            var x = void 0,
                y = void 0,
                delta = void 0,
                deltaY = void 0;
            if (this.pressed) {
              x = this._xpos(e);
              y = this._ypos(e);
              delta = this.reference - x;
              deltaY = Math.abs(this.referenceY - y);
              if (deltaY < 30 && !this.verticalDragged) {
                // If vertical scrolling don't allow dragging.
                if (delta > 2 || delta < -2) {
                  this.dragged = true;
                  this.reference = x;
                  this._scroll(this.offset + delta);
                }
              } else if (this.dragged) {
                // If dragging don't allow vertical scroll.
                e.preventDefault();
                e.stopPropagation();
                return false;
              } else {
                // Vertical scrolling.
                this.verticalDragged = true;
              }
            }

            if (this.dragged) {
              // If dragging don't allow vertical scroll.
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }

          /**
           * Handle Carousel Release
           * @param {Event} e
           */

        }, {
          key: "_handleCarouselRelease",
          value: function _handleCarouselRelease(e) {
            if (this.pressed) {
              this.pressed = false;
            } else {
              return;
            }

            clearInterval(this.ticker);
            this.target = this.offset;
            if (this.velocity > 10 || this.velocity < -10) {
              this.amplitude = 0.9 * this.velocity;
              this.target = this.offset + this.amplitude;
            }
            this.target = Math.round(this.target / this.dim) * this.dim;

            // No wrap of items.
            if (this.noWrap) {
              if (this.target >= this.dim * (this.count - 1)) {
                this.target = this.dim * (this.count - 1);
              } else if (this.target < 0) {
                this.target = 0;
              }
            }
            this.amplitude = this.target - this.offset;
            this.timestamp = Date.now();
            requestAnimationFrame(this._autoScrollBound);

            if (this.dragged) {
              e.preventDefault();
              e.stopPropagation();
            }
            return false;
          }

          /**
           * Handle Carousel CLick
           * @param {Event} e
           */

        }, {
          key: "_handleCarouselClick",
          value: function _handleCarouselClick(e) {
            // Disable clicks if carousel was dragged.
            if (this.dragged) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            } else if (!this.options.fullWidth) {
              var clickedIndex = $(e.target).closest('.carousel-item').index();
              var diff = this._wrap(this.center) - clickedIndex;

              // Disable clicks if carousel was shifted by click
              if (diff !== 0) {
                e.preventDefault();
                e.stopPropagation();
              }
              this._cycleTo(clickedIndex);
            }
          }

          /**
           * Handle Indicator CLick
           * @param {Event} e
           */

        }, {
          key: "_handleIndicatorClick",
          value: function _handleIndicatorClick(e) {
            e.stopPropagation();

            var indicator = $(e.target).closest('.indicator-item');
            if (indicator.length) {
              this._cycleTo(indicator.index());
            }
          }

          /**
           * Handle Throttle Resize
           * @param {Event} e
           */

        }, {
          key: "_handleResize",
          value: function _handleResize(e) {
            if (this.options.fullWidth) {
              this.itemWidth = this.$el.find('.carousel-item').first().innerWidth();
              this.imageHeight = this.$el.find('.carousel-item.active').height();
              this.dim = this.itemWidth * 2 + this.options.padding;
              this.offset = this.center * 2 * this.itemWidth;
              this.target = this.offset;
              this._setCarouselHeight(true);
            } else {
              this._scroll();
            }
          }

          /**
           * Set carousel height based on first slide
           * @param {Booleam} imageOnly - true for image slides
           */

        }, {
          key: "_setCarouselHeight",
          value: function _setCarouselHeight(imageOnly) {
            var _this65 = this;

            var firstSlide = this.$el.find('.carousel-item.active').length ? this.$el.find('.carousel-item.active').first() : this.$el.find('.carousel-item').first();
            var firstImage = firstSlide.find('img').first();
            if (firstImage.length) {
              if (firstImage[0].complete) {
                // If image won't trigger the load event
                var imageHeight = firstImage.height();
                if (imageHeight > 0) {
                  this.$el.css('height', imageHeight + 'px');
                } else {
                  // If image still has no height, use the natural dimensions to calculate
                  var naturalWidth = firstImage[0].naturalWidth;
                  var naturalHeight = firstImage[0].naturalHeight;
                  var adjustedHeight = this.$el.width() / naturalWidth * naturalHeight;
                  this.$el.css('height', adjustedHeight + 'px');
                }
              } else {
                // Get height when image is loaded normally
                firstImage.one('load', function (el, i) {
                  _this65.$el.css('height', el.offsetHeight + 'px');
                });
              }
            } else if (!imageOnly) {
              var slideHeight = firstSlide.height();
              this.$el.css('height', slideHeight + 'px');
            }
          }

          /**
           * Get x position from event
           * @param {Event} e
           */

        }, {
          key: "_xpos",
          value: function _xpos(e) {
            // touch event
            if (e.targetTouches && e.targetTouches.length >= 1) {
              return e.targetTouches[0].clientX;
            }

            // mouse event
            return e.clientX;
          }

          /**
           * Get y position from event
           * @param {Event} e
           */

        }, {
          key: "_ypos",
          value: function _ypos(e) {
            // touch event
            if (e.targetTouches && e.targetTouches.length >= 1) {
              return e.targetTouches[0].clientY;
            }

            // mouse event
            return e.clientY;
          }

          /**
           * Wrap index
           * @param {Number} x
           */

        }, {
          key: "_wrap",
          value: function _wrap(x) {
            return x >= this.count ? x % this.count : x < 0 ? this._wrap(this.count + x % this.count) : x;
          }

          /**
           * Tracks scrolling information
           */

        }, {
          key: "_track",
          value: function _track() {
            var now = void 0,
                elapsed = void 0,
                delta = void 0,
                v = void 0;

            now = Date.now();
            elapsed = now - this.timestamp;
            this.timestamp = now;
            delta = this.offset - this.frame;
            this.frame = this.offset;

            v = 1000 * delta / (1 + elapsed);
            this.velocity = 0.8 * v + 0.2 * this.velocity;
          }

          /**
           * Auto scrolls to nearest carousel item.
           */

        }, {
          key: "_autoScroll",
          value: function _autoScroll() {
            var elapsed = void 0,
                delta = void 0;

            if (this.amplitude) {
              elapsed = Date.now() - this.timestamp;
              delta = this.amplitude * Math.exp(-elapsed / this.options.duration);
              if (delta > 2 || delta < -2) {
                this._scroll(this.target - delta);
                requestAnimationFrame(this._autoScrollBound);
              } else {
                this._scroll(this.target);
              }
            }
          }

          /**
           * Scroll to target
           * @param {Number} x
           */

        }, {
          key: "_scroll",
          value: function _scroll(x) {
            var _this66 = this;

            // Track scrolling state
            if (!this.$el.hasClass('scrolling')) {
              this.el.classList.add('scrolling');
            }
            if (this.scrollingTimeout != null) {
              window.clearTimeout(this.scrollingTimeout);
            }
            this.scrollingTimeout = window.setTimeout(function () {
              _this66.$el.removeClass('scrolling');
            }, this.options.duration);

            // Start actual scroll
            var i = void 0,
                half = void 0,
                delta = void 0,
                dir = void 0,
                tween = void 0,
                el = void 0,
                alignment = void 0,
                zTranslation = void 0,
                tweenedOpacity = void 0,
                centerTweenedOpacity = void 0;
            var lastCenter = this.center;
            var numVisibleOffset = 1 / this.options.numVisible;

            this.offset = typeof x === 'number' ? x : this.offset;
            this.center = Math.floor((this.offset + this.dim / 2) / this.dim);
            delta = this.offset - this.center * this.dim;
            dir = delta < 0 ? 1 : -1;
            tween = -dir * delta * 2 / this.dim;
            half = this.count >> 1;

            if (this.options.fullWidth) {
              alignment = 'translateX(0)';
              centerTweenedOpacity = 1;
            } else {
              alignment = 'translateX(' + (this.el.clientWidth - this.itemWidth) / 2 + 'px) ';
              alignment += 'translateY(' + (this.el.clientHeight - this.itemHeight) / 2 + 'px)';
              centerTweenedOpacity = 1 - numVisibleOffset * tween;
            }

            // Set indicator active
            if (this.showIndicators) {
              var diff = this.center % this.count;
              var activeIndicator = this.$indicators.find('.indicator-item.active');
              if (activeIndicator.index() !== diff) {
                activeIndicator.removeClass('active');
                this.$indicators.find('.indicator-item').eq(diff)[0].classList.add('active');
              }
            }

            // center
            // Don't show wrapped items.
            if (!this.noWrap || this.center >= 0 && this.center < this.count) {
              el = this.images[this._wrap(this.center)];

              // Add active class to center item.
              if (!$(el).hasClass('active')) {
                this.$el.find('.carousel-item').removeClass('active');
                el.classList.add('active');
              }
              var transformString = alignment + " translateX(" + -delta / 2 + "px) translateX(" + dir * this.options.shift * tween * i + "px) translateZ(" + this.options.dist * tween + "px)";
              this._updateItemStyle(el, centerTweenedOpacity, 0, transformString);
            }

            for (i = 1; i <= half; ++i) {
              // right side
              if (this.options.fullWidth) {
                zTranslation = this.options.dist;
                tweenedOpacity = i === half && delta < 0 ? 1 - tween : 1;
              } else {
                zTranslation = this.options.dist * (i * 2 + tween * dir);
                tweenedOpacity = 1 - numVisibleOffset * (i * 2 + tween * dir);
              }
              // Don't show wrapped items.
              if (!this.noWrap || this.center + i < this.count) {
                el = this.images[this._wrap(this.center + i)];
                var _transformString = alignment + " translateX(" + (this.options.shift + (this.dim * i - delta) / 2) + "px) translateZ(" + zTranslation + "px)";
                this._updateItemStyle(el, tweenedOpacity, -i, _transformString);
              }

              // left side
              if (this.options.fullWidth) {
                zTranslation = this.options.dist;
                tweenedOpacity = i === half && delta > 0 ? 1 - tween : 1;
              } else {
                zTranslation = this.options.dist * (i * 2 - tween * dir);
                tweenedOpacity = 1 - numVisibleOffset * (i * 2 - tween * dir);
              }
              // Don't show wrapped items.
              if (!this.noWrap || this.center - i >= 0) {
                el = this.images[this._wrap(this.center - i)];
                var _transformString2 = alignment + " translateX(" + (-this.options.shift + (-this.dim * i - delta) / 2) + "px) translateZ(" + zTranslation + "px)";
                this._updateItemStyle(el, tweenedOpacity, -i, _transformString2);
              }
            }

            // center
            // Don't show wrapped items.
            if (!this.noWrap || this.center >= 0 && this.center < this.count) {
              el = this.images[this._wrap(this.center)];
              var _transformString3 = alignment + " translateX(" + -delta / 2 + "px) translateX(" + dir * this.options.shift * tween + "px) translateZ(" + this.options.dist * tween + "px)";
              this._updateItemStyle(el, centerTweenedOpacity, 0, _transformString3);
            }

            // onCycleTo callback
            var $currItem = this.$el.find('.carousel-item').eq(this._wrap(this.center));
            if (lastCenter !== this.center && typeof this.options.onCycleTo === 'function') {
              this.options.onCycleTo.call(this, $currItem[0], this.dragged);
            }

            // One time callback
            if (typeof this.oneTimeCallback === 'function') {
              this.oneTimeCallback.call(this, $currItem[0], this.dragged);
              this.oneTimeCallback = null;
            }
          }

          /**
           * Cycle to target
           * @param {Element} el
           * @param {Number} opacity
           * @param {Number} zIndex
           * @param {String} transform
           */

        }, {
          key: "_updateItemStyle",
          value: function _updateItemStyle(el, opacity, zIndex, transform) {
            el.style[this.xform] = transform;
            el.style.zIndex = zIndex;
            el.style.opacity = opacity;
            el.style.visibility = 'visible';
          }

          /**
           * Cycle to target
           * @param {Number} n
           * @param {Function} callback
           */

        }, {
          key: "_cycleTo",
          value: function _cycleTo(n, callback) {
            var diff = this.center % this.count - n;

            // Account for wraparound.
            if (!this.noWrap) {
              if (diff < 0) {
                if (Math.abs(diff + this.count) < Math.abs(diff)) {
                  diff += this.count;
                }
              } else if (diff > 0) {
                if (Math.abs(diff - this.count) < diff) {
                  diff -= this.count;
                }
              }
            }

            this.target = this.dim * Math.round(this.offset / this.dim);
            // Next
            if (diff < 0) {
              this.target += this.dim * Math.abs(diff);

              // Prev
            } else if (diff > 0) {
              this.target -= this.dim * diff;
            }

            // Set one time callback
            if (typeof callback === 'function') {
              this.oneTimeCallback = callback;
            }

            // Scroll
            if (this.offset !== this.target) {
              this.amplitude = this.target - this.offset;
              this.timestamp = Date.now();
              requestAnimationFrame(this._autoScrollBound);
            }
          }

          /**
           * Cycle to next item
           * @param {Number} [n]
           */

        }, {
          key: "next",
          value: function next(n) {
            if (n === undefined || isNaN(n)) {
              n = 1;
            }

            var index = this.center + n;
            if (index >= this.count || index < 0) {
              if (this.noWrap) {
                return;
              }

              index = this._wrap(index);
            }
            this._cycleTo(index);
          }

          /**
           * Cycle to previous item
           * @param {Number} [n]
           */

        }, {
          key: "prev",
          value: function prev(n) {
            if (n === undefined || isNaN(n)) {
              n = 1;
            }

            var index = this.center - n;
            if (index >= this.count || index < 0) {
              if (this.noWrap) {
                return;
              }

              index = this._wrap(index);
            }

            this._cycleTo(index);
          }

          /**
           * Cycle to nth item
           * @param {Number} [n]
           * @param {Function} callback
           */

        }, {
          key: "set",
          value: function set(n, callback) {
            if (n === undefined || isNaN(n)) {
              n = 0;
            }

            if (n > this.count || n < 0) {
              if (this.noWrap) {
                return;
              }

              n = this._wrap(n);
            }

            this._cycleTo(n, callback);
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Carousel.__proto__ || Object.getPrototypeOf(Carousel), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Carousel;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Carousel;
      }(Component);

      M.Carousel = Carousel;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Carousel, 'carousel', 'M_Carousel');
      }
    })(cash);
    (function ($) {

      var _defaults = {
        onOpen: undefined,
        onClose: undefined
      };

      /**
       * @class
       *
       */

      var TapTarget = function (_Component19) {
        _inherits(TapTarget, _Component19);

        /**
         * Construct TapTarget instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function TapTarget(el, options) {
          _classCallCheck(this, TapTarget);

          var _this67 = _possibleConstructorReturn(this, (TapTarget.__proto__ || Object.getPrototypeOf(TapTarget)).call(this, TapTarget, el, options));

          _this67.el.M_TapTarget = _this67;

          /**
           * Options for the select
           * @member TapTarget#options
           * @prop {Function} onOpen - Callback function called when feature discovery is opened
           * @prop {Function} onClose - Callback function called when feature discovery is closed
           */
          _this67.options = $.extend({}, TapTarget.defaults, options);

          _this67.isOpen = false;

          // setup
          _this67.$origin = $('#' + _this67.$el.attr('data-target'));
          _this67._setup();

          _this67._calculatePositioning();
          _this67._setupEventHandlers();
          return _this67;
        }

        _createClass(TapTarget, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this.el.TapTarget = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleDocumentClickBound = this._handleDocumentClick.bind(this);
            this._handleTargetClickBound = this._handleTargetClick.bind(this);
            this._handleOriginClickBound = this._handleOriginClick.bind(this);

            this.el.addEventListener('click', this._handleTargetClickBound);
            this.originEl.addEventListener('click', this._handleOriginClickBound);

            // Resize
            var throttledResize = M.throttle(this._handleResize, 200);
            this._handleThrottledResizeBound = throttledResize.bind(this);

            window.addEventListener('resize', this._handleThrottledResizeBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('click', this._handleTargetClickBound);
            this.originEl.removeEventListener('click', this._handleOriginClickBound);
            window.removeEventListener('resize', this._handleThrottledResizeBound);
          }

          /**
           * Handle Target Click
           * @param {Event} e
           */

        }, {
          key: "_handleTargetClick",
          value: function _handleTargetClick(e) {
            this.open();
          }

          /**
           * Handle Origin Click
           * @param {Event} e
           */

        }, {
          key: "_handleOriginClick",
          value: function _handleOriginClick(e) {
            this.close();
          }

          /**
           * Handle Resize
           * @param {Event} e
           */

        }, {
          key: "_handleResize",
          value: function _handleResize(e) {
            this._calculatePositioning();
          }

          /**
           * Handle Resize
           * @param {Event} e
           */

        }, {
          key: "_handleDocumentClick",
          value: function _handleDocumentClick(e) {
            if (!$(e.target).closest('.tap-target-wrapper').length) {
              this.close();
              e.preventDefault();
              e.stopPropagation();
            }
          }

          /**
           * Setup Tap Target
           */

        }, {
          key: "_setup",
          value: function _setup() {
            // Creating tap target
            this.wrapper = this.$el.parent()[0];
            this.waveEl = $(this.wrapper).find('.tap-target-wave')[0];
            this.originEl = $(this.wrapper).find('.tap-target-origin')[0];
            this.contentEl = this.$el.find('.tap-target-content')[0];

            // Creating wrapper
            if (!$(this.wrapper).hasClass('.tap-target-wrapper')) {
              this.wrapper = document.createElement('div');
              this.wrapper.classList.add('tap-target-wrapper');
              this.$el.before($(this.wrapper));
              this.wrapper.append(this.el);
            }

            // Creating content
            if (!this.contentEl) {
              this.contentEl = document.createElement('div');
              this.contentEl.classList.add('tap-target-content');
              this.$el.append(this.contentEl);
            }

            // Creating foreground wave
            if (!this.waveEl) {
              this.waveEl = document.createElement('div');
              this.waveEl.classList.add('tap-target-wave');

              // Creating origin
              if (!this.originEl) {
                this.originEl = this.$origin.clone(true, true);
                this.originEl.addClass('tap-target-origin');
                this.originEl.removeAttr('id');
                this.originEl.removeAttr('style');
                this.originEl = this.originEl[0];
                this.waveEl.append(this.originEl);
              }

              this.wrapper.append(this.waveEl);
            }
          }

          /**
           * Calculate positioning
           */

        }, {
          key: "_calculatePositioning",
          value: function _calculatePositioning() {
            // Element or parent is fixed position?
            var isFixed = this.$origin.css('position') === 'fixed';
            if (!isFixed) {
              var parents = this.$origin.parents();
              for (var i = 0; i < parents.length; i++) {
                isFixed = $(parents[i]).css('position') == 'fixed';
                if (isFixed) {
                  break;
                }
              }
            }

            // Calculating origin
            var originWidth = this.$origin.outerWidth();
            var originHeight = this.$origin.outerHeight();
            var originTop = isFixed ? this.$origin.offset().top - M.getDocumentScrollTop() : this.$origin.offset().top;
            var originLeft = isFixed ? this.$origin.offset().left - M.getDocumentScrollLeft() : this.$origin.offset().left;

            // Calculating screen
            var windowWidth = window.innerWidth;
            var windowHeight = window.innerHeight;
            var centerX = windowWidth / 2;
            var centerY = windowHeight / 2;
            var isLeft = originLeft <= centerX;
            var isRight = originLeft > centerX;
            var isTop = originTop <= centerY;
            var isBottom = originTop > centerY;
            var isCenterX = originLeft >= windowWidth * 0.25 && originLeft <= windowWidth * 0.75;

            // Calculating tap target
            var tapTargetWidth = this.$el.outerWidth();
            var tapTargetHeight = this.$el.outerHeight();
            var tapTargetTop = originTop + originHeight / 2 - tapTargetHeight / 2;
            var tapTargetLeft = originLeft + originWidth / 2 - tapTargetWidth / 2;
            var tapTargetPosition = isFixed ? 'fixed' : 'absolute';

            // Calculating content
            var tapTargetTextWidth = isCenterX ? tapTargetWidth : tapTargetWidth / 2 + originWidth;
            var tapTargetTextHeight = tapTargetHeight / 2;
            var tapTargetTextTop = isTop ? tapTargetHeight / 2 : 0;
            var tapTargetTextBottom = 0;
            var tapTargetTextLeft = isLeft && !isCenterX ? tapTargetWidth / 2 - originWidth : 0;
            var tapTargetTextRight = 0;
            var tapTargetTextPadding = originWidth;
            var tapTargetTextAlign = isBottom ? 'bottom' : 'top';

            // Calculating wave
            var tapTargetWaveWidth = originWidth > originHeight ? originWidth * 2 : originWidth * 2;
            var tapTargetWaveHeight = tapTargetWaveWidth;
            var tapTargetWaveTop = tapTargetHeight / 2 - tapTargetWaveHeight / 2;
            var tapTargetWaveLeft = tapTargetWidth / 2 - tapTargetWaveWidth / 2;

            // Setting tap target
            var tapTargetWrapperCssObj = {};
            tapTargetWrapperCssObj.top = isTop ? tapTargetTop + 'px' : '';
            tapTargetWrapperCssObj.right = isRight ? windowWidth - tapTargetLeft - tapTargetWidth + 'px' : '';
            tapTargetWrapperCssObj.bottom = isBottom ? windowHeight - tapTargetTop - tapTargetHeight + 'px' : '';
            tapTargetWrapperCssObj.left = isLeft ? tapTargetLeft + 'px' : '';
            tapTargetWrapperCssObj.position = tapTargetPosition;
            $(this.wrapper).css(tapTargetWrapperCssObj);

            // Setting content
            $(this.contentEl).css({
              width: tapTargetTextWidth + 'px',
              height: tapTargetTextHeight + 'px',
              top: tapTargetTextTop + 'px',
              right: tapTargetTextRight + 'px',
              bottom: tapTargetTextBottom + 'px',
              left: tapTargetTextLeft + 'px',
              padding: tapTargetTextPadding + 'px',
              verticalAlign: tapTargetTextAlign
            });

            // Setting wave
            $(this.waveEl).css({
              top: tapTargetWaveTop + 'px',
              left: tapTargetWaveLeft + 'px',
              width: tapTargetWaveWidth + 'px',
              height: tapTargetWaveHeight + 'px'
            });
          }

          /**
           * Open TapTarget
           */

        }, {
          key: "open",
          value: function open() {
            if (this.isOpen) {
              return;
            }

            // onOpen callback
            if (typeof this.options.onOpen === 'function') {
              this.options.onOpen.call(this, this.$origin[0]);
            }

            this.isOpen = true;
            this.wrapper.classList.add('open');

            document.body.addEventListener('click', this._handleDocumentClickBound, true);
            document.body.addEventListener('touchend', this._handleDocumentClickBound);
          }

          /**
           * Close Tap Target
           */

        }, {
          key: "close",
          value: function close() {
            if (!this.isOpen) {
              return;
            }

            // onClose callback
            if (typeof this.options.onClose === 'function') {
              this.options.onClose.call(this, this.$origin[0]);
            }

            this.isOpen = false;
            this.wrapper.classList.remove('open');

            document.body.removeEventListener('click', this._handleDocumentClickBound, true);
            document.body.removeEventListener('touchend', this._handleDocumentClickBound);
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(TapTarget.__proto__ || Object.getPrototypeOf(TapTarget), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_TapTarget;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return TapTarget;
      }(Component);

      M.TapTarget = TapTarget;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(TapTarget, 'tapTarget', 'M_TapTarget');
      }
    })(cash);
    (function ($) {

      var _defaults = {
        classes: '',
        dropdownOptions: {}
      };

      /**
       * @class
       *
       */

      var FormSelect = function (_Component20) {
        _inherits(FormSelect, _Component20);

        /**
         * Construct FormSelect instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function FormSelect(el, options) {
          _classCallCheck(this, FormSelect);

          // Don't init if browser default version
          var _this68 = _possibleConstructorReturn(this, (FormSelect.__proto__ || Object.getPrototypeOf(FormSelect)).call(this, FormSelect, el, options));

          if (_this68.$el.hasClass('browser-default')) {
            return _possibleConstructorReturn(_this68);
          }

          _this68.el.M_FormSelect = _this68;

          /**
           * Options for the select
           * @member FormSelect#options
           */
          _this68.options = $.extend({}, FormSelect.defaults, options);

          _this68.isMultiple = _this68.$el.prop('multiple');

          // Setup
          _this68.el.tabIndex = -1;
          _this68._keysSelected = {};
          _this68._valueDict = {}; // Maps key to original and generated option element.
          _this68._setupDropdown();

          _this68._setupEventHandlers();
          return _this68;
        }

        _createClass(FormSelect, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this._removeDropdown();
            this.el.M_FormSelect = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            var _this69 = this;

            this._handleSelectChangeBound = this._handleSelectChange.bind(this);
            this._handleOptionClickBound = this._handleOptionClick.bind(this);
            this._handleInputClickBound = this._handleInputClick.bind(this);

            $(this.dropdownOptions).find('li:not(.optgroup)').each(function (el) {
              el.addEventListener('click', _this69._handleOptionClickBound);
            });
            this.el.addEventListener('change', this._handleSelectChangeBound);
            this.input.addEventListener('click', this._handleInputClickBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            var _this70 = this;

            $(this.dropdownOptions).find('li:not(.optgroup)').each(function (el) {
              el.removeEventListener('click', _this70._handleOptionClickBound);
            });
            this.el.removeEventListener('change', this._handleSelectChangeBound);
            this.input.removeEventListener('click', this._handleInputClickBound);
          }

          /**
           * Handle Select Change
           * @param {Event} e
           */

        }, {
          key: "_handleSelectChange",
          value: function _handleSelectChange(e) {
            this._setValueToInput();
          }

          /**
           * Handle Option Click
           * @param {Event} e
           */

        }, {
          key: "_handleOptionClick",
          value: function _handleOptionClick(e) {
            e.preventDefault();
            var option = $(e.target).closest('li')[0];
            var key = option.id;
            if (!$(option).hasClass('disabled') && !$(option).hasClass('optgroup') && key.length) {
              var selected = true;

              if (this.isMultiple) {
                // Deselect placeholder option if still selected.
                var placeholderOption = $(this.dropdownOptions).find('li.disabled.selected');
                if (placeholderOption.length) {
                  placeholderOption.removeClass('selected');
                  placeholderOption.find('input[type="checkbox"]').prop('checked', false);
                  this._toggleEntryFromArray(placeholderOption[0].id);
                }
                selected = this._toggleEntryFromArray(key);
              } else {
                $(this.dropdownOptions).find('li').removeClass('selected');
                $(option).toggleClass('selected', selected);
              }

              // Set selected on original select option
              // Only trigger if selected state changed
              var prevSelected = $(this._valueDict[key].el).prop('selected');
              if (prevSelected !== selected) {
                $(this._valueDict[key].el).prop('selected', selected);
                this.$el.trigger('change');
              }
            }

            e.stopPropagation();
          }

          /**
           * Handle Input Click
           */

        }, {
          key: "_handleInputClick",
          value: function _handleInputClick() {
            if (this.dropdown && this.dropdown.isOpen) {
              this._setValueToInput();
              this._setSelectedStates();
            }
          }

          /**
           * Setup dropdown
           */

        }, {
          key: "_setupDropdown",
          value: function _setupDropdown() {
            var _this71 = this;

            this.wrapper = document.createElement('div');
            $(this.wrapper).addClass('select-wrapper ' + this.options.classes);
            this.$el.before($(this.wrapper));
            this.wrapper.appendChild(this.el);

            if (this.el.disabled) {
              this.wrapper.classList.add('disabled');
            }

            // Create dropdown
            this.$selectOptions = this.$el.children('option, optgroup');
            this.dropdownOptions = document.createElement('ul');
            this.dropdownOptions.id = "select-options-" + M.guid();
            $(this.dropdownOptions).addClass('dropdown-content select-dropdown ' + (this.isMultiple ? 'multiple-select-dropdown' : ''));

            // Create dropdown structure.
            if (this.$selectOptions.length) {
              this.$selectOptions.each(function (el) {
                if ($(el).is('option')) {
                  // Direct descendant option.
                  var optionEl = void 0;
                  if (_this71.isMultiple) {
                    optionEl = _this71._appendOptionWithIcon(_this71.$el, el, 'multiple');
                  } else {
                    optionEl = _this71._appendOptionWithIcon(_this71.$el, el);
                  }

                  _this71._addOptionToValueDict(el, optionEl);
                } else if ($(el).is('optgroup')) {
                  // Optgroup.
                  var selectOptions = $(el).children('option');
                  $(_this71.dropdownOptions).append($('<li class="optgroup"><span>' + el.getAttribute('label') + '</span></li>')[0]);

                  selectOptions.each(function (el) {
                    var optionEl = _this71._appendOptionWithIcon(_this71.$el, el, 'optgroup-option');
                    _this71._addOptionToValueDict(el, optionEl);
                  });
                }
              });
            }

            this.$el.after(this.dropdownOptions);

            // Add input dropdown
            this.input = document.createElement('input');
            $(this.input).addClass('select-dropdown dropdown-trigger');
            this.input.setAttribute('type', 'text');
            this.input.setAttribute('readonly', 'true');
            this.input.setAttribute('data-target', this.dropdownOptions.id);
            if (this.el.disabled) {
              $(this.input).prop('disabled', 'true');
            }

            this.$el.before(this.input);
            this._setValueToInput();

            // Add caret
            var dropdownIcon = $('<svg class="caret" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>');
            this.$el.before(dropdownIcon[0]);

            // Initialize dropdown
            if (!this.el.disabled) {
              var dropdownOptions = $.extend({}, this.options.dropdownOptions);

              // Add callback for centering selected option when dropdown content is scrollable
              dropdownOptions.onOpenEnd = function (el) {
                var selectedOption = $(_this71.dropdownOptions).find('.selected').first();

                if (selectedOption.length) {
                  // Focus selected option in dropdown
                  M.keyDown = true;
                  _this71.dropdown.focusedIndex = selectedOption.index();
                  _this71.dropdown._focusFocusedItem();
                  M.keyDown = false;

                  // Handle scrolling to selected option
                  if (_this71.dropdown.isScrollable) {
                    var scrollOffset = selectedOption[0].getBoundingClientRect().top - _this71.dropdownOptions.getBoundingClientRect().top; // scroll to selected option
                    scrollOffset -= _this71.dropdownOptions.clientHeight / 2; // center in dropdown
                    _this71.dropdownOptions.scrollTop = scrollOffset;
                  }
                }
              };

              if (this.isMultiple) {
                dropdownOptions.closeOnClick = false;
              }
              this.dropdown = M.Dropdown.init(this.input, dropdownOptions);
            }

            // Add initial selections
            this._setSelectedStates();
          }

          /**
           * Add option to value dict
           * @param {Element} el  original option element
           * @param {Element} optionEl  generated option element
           */

        }, {
          key: "_addOptionToValueDict",
          value: function _addOptionToValueDict(el, optionEl) {
            var index = Object.keys(this._valueDict).length;
            var key = this.dropdownOptions.id + index;
            var obj = {};
            optionEl.id = key;

            obj.el = el;
            obj.optionEl = optionEl;
            this._valueDict[key] = obj;
          }

          /**
           * Remove dropdown
           */

        }, {
          key: "_removeDropdown",
          value: function _removeDropdown() {
            $(this.wrapper).find('.caret').remove();
            $(this.input).remove();
            $(this.dropdownOptions).remove();
            $(this.wrapper).before(this.$el);
            $(this.wrapper).remove();
          }

          /**
           * Setup dropdown
           * @param {Element} select  select element
           * @param {Element} option  option element from select
           * @param {String} type
           * @return {Element}  option element added
           */

        }, {
          key: "_appendOptionWithIcon",
          value: function _appendOptionWithIcon(select, option, type) {
            // Add disabled attr if disabled
            var disabledClass = option.disabled ? 'disabled ' : '';
            var optgroupClass = type === 'optgroup-option' ? 'optgroup-option ' : '';
            var multipleCheckbox = this.isMultiple ? "<label><input type=\"checkbox\"" + disabledClass + "\"/><span>" + option.innerHTML + "</span></label>" : option.innerHTML;
            var liEl = $('<li></li>');
            var spanEl = $('<span></span>');
            spanEl.html(multipleCheckbox);
            liEl.addClass(disabledClass + " " + optgroupClass);
            liEl.append(spanEl);

            // add icons
            var iconUrl = option.getAttribute('data-icon');
            if (!!iconUrl) {
              var imgEl = $("<img alt=\"\" src=\"" + iconUrl + "\">");
              liEl.prepend(imgEl);
            }

            // Check for multiple type.
            $(this.dropdownOptions).append(liEl[0]);
            return liEl[0];
          }

          /**
           * Toggle entry from option
           * @param {String} key  Option key
           * @return {Boolean}  if entry was added or removed
           */

        }, {
          key: "_toggleEntryFromArray",
          value: function _toggleEntryFromArray(key) {
            var notAdded = !this._keysSelected.hasOwnProperty(key);
            var $optionLi = $(this._valueDict[key].optionEl);

            if (notAdded) {
              this._keysSelected[key] = true;
            } else {
              delete this._keysSelected[key];
            }

            $optionLi.toggleClass('selected', notAdded);

            // Set checkbox checked value
            $optionLi.find('input[type="checkbox"]').prop('checked', notAdded);

            // use notAdded instead of true (to detect if the option is selected or not)
            $optionLi.prop('selected', notAdded);

            return notAdded;
          }

          /**
           * Set text value to input
           */

        }, {
          key: "_setValueToInput",
          value: function _setValueToInput() {
            var values = [];
            var options = this.$el.find('option');

            options.each(function (el) {
              if ($(el).prop('selected')) {
                var text = $(el).text();
                values.push(text);
              }
            });

            if (!values.length) {
              var firstDisabled = this.$el.find('option:disabled').eq(0);
              if (firstDisabled.length && firstDisabled[0].value === '') {
                values.push(firstDisabled.text());
              }
            }

            this.input.value = values.join(', ');
          }

          /**
           * Set selected state of dropdown to match actual select element
           */

        }, {
          key: "_setSelectedStates",
          value: function _setSelectedStates() {
            this._keysSelected = {};

            for (var key in this._valueDict) {
              var option = this._valueDict[key];
              var optionIsSelected = $(option.el).prop('selected');
              $(option.optionEl).find('input[type="checkbox"]').prop('checked', optionIsSelected);
              if (optionIsSelected) {
                this._activateOption($(this.dropdownOptions), $(option.optionEl));
                this._keysSelected[key] = true;
              } else {
                $(option.optionEl).removeClass('selected');
              }
            }
          }

          /**
           * Make option as selected and scroll to selected position
           * @param {jQuery} collection  Select options jQuery element
           * @param {Element} newOption  element of the new option
           */

        }, {
          key: "_activateOption",
          value: function _activateOption(collection, newOption) {
            if (newOption) {
              if (!this.isMultiple) {
                collection.find('li.selected').removeClass('selected');
              }
              var option = $(newOption);
              option.addClass('selected');
            }
          }

          /**
           * Get Selected Values
           * @return {Array}  Array of selected values
           */

        }, {
          key: "getSelectedValues",
          value: function getSelectedValues() {
            var selectedValues = [];
            for (var key in this._keysSelected) {
              selectedValues.push(this._valueDict[key].el.value);
            }
            return selectedValues;
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(FormSelect.__proto__ || Object.getPrototypeOf(FormSelect), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_FormSelect;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return FormSelect;
      }(Component);

      M.FormSelect = FormSelect;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(FormSelect, 'formSelect', 'M_FormSelect');
      }
    })(cash);
    (function ($, anim) {

      var _defaults = {};

      /**
       * @class
       *
       */

      var Range = function (_Component21) {
        _inherits(Range, _Component21);

        /**
         * Construct Range instance
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Range(el, options) {
          _classCallCheck(this, Range);

          var _this72 = _possibleConstructorReturn(this, (Range.__proto__ || Object.getPrototypeOf(Range)).call(this, Range, el, options));

          _this72.el.M_Range = _this72;

          /**
           * Options for the range
           * @member Range#options
           */
          _this72.options = $.extend({}, Range.defaults, options);

          _this72._mousedown = false;

          // Setup
          _this72._setupThumb();

          _this72._setupEventHandlers();
          return _this72;
        }

        _createClass(Range, [{
          key: "destroy",


          /**
           * Teardown component
           */
          value: function destroy() {
            this._removeEventHandlers();
            this._removeThumb();
            this.el.M_Range = undefined;
          }

          /**
           * Setup Event Handlers
           */

        }, {
          key: "_setupEventHandlers",
          value: function _setupEventHandlers() {
            this._handleRangeChangeBound = this._handleRangeChange.bind(this);
            this._handleRangeMousedownTouchstartBound = this._handleRangeMousedownTouchstart.bind(this);
            this._handleRangeInputMousemoveTouchmoveBound = this._handleRangeInputMousemoveTouchmove.bind(this);
            this._handleRangeMouseupTouchendBound = this._handleRangeMouseupTouchend.bind(this);
            this._handleRangeBlurMouseoutTouchleaveBound = this._handleRangeBlurMouseoutTouchleave.bind(this);

            this.el.addEventListener('change', this._handleRangeChangeBound);

            this.el.addEventListener('mousedown', this._handleRangeMousedownTouchstartBound);
            this.el.addEventListener('touchstart', this._handleRangeMousedownTouchstartBound);

            this.el.addEventListener('input', this._handleRangeInputMousemoveTouchmoveBound);
            this.el.addEventListener('mousemove', this._handleRangeInputMousemoveTouchmoveBound);
            this.el.addEventListener('touchmove', this._handleRangeInputMousemoveTouchmoveBound);

            this.el.addEventListener('mouseup', this._handleRangeMouseupTouchendBound);
            this.el.addEventListener('touchend', this._handleRangeMouseupTouchendBound);

            this.el.addEventListener('blur', this._handleRangeBlurMouseoutTouchleaveBound);
            this.el.addEventListener('mouseout', this._handleRangeBlurMouseoutTouchleaveBound);
            this.el.addEventListener('touchleave', this._handleRangeBlurMouseoutTouchleaveBound);
          }

          /**
           * Remove Event Handlers
           */

        }, {
          key: "_removeEventHandlers",
          value: function _removeEventHandlers() {
            this.el.removeEventListener('change', this._handleRangeChangeBound);

            this.el.removeEventListener('mousedown', this._handleRangeMousedownTouchstartBound);
            this.el.removeEventListener('touchstart', this._handleRangeMousedownTouchstartBound);

            this.el.removeEventListener('input', this._handleRangeInputMousemoveTouchmoveBound);
            this.el.removeEventListener('mousemove', this._handleRangeInputMousemoveTouchmoveBound);
            this.el.removeEventListener('touchmove', this._handleRangeInputMousemoveTouchmoveBound);

            this.el.removeEventListener('mouseup', this._handleRangeMouseupTouchendBound);
            this.el.removeEventListener('touchend', this._handleRangeMouseupTouchendBound);

            this.el.removeEventListener('blur', this._handleRangeBlurMouseoutTouchleaveBound);
            this.el.removeEventListener('mouseout', this._handleRangeBlurMouseoutTouchleaveBound);
            this.el.removeEventListener('touchleave', this._handleRangeBlurMouseoutTouchleaveBound);
          }

          /**
           * Handle Range Change
           * @param {Event} e
           */

        }, {
          key: "_handleRangeChange",
          value: function _handleRangeChange() {
            $(this.value).html(this.$el.val());

            if (!$(this.thumb).hasClass('active')) {
              this._showRangeBubble();
            }

            var offsetLeft = this._calcRangeOffset();
            $(this.thumb).addClass('active').css('left', offsetLeft + 'px');
          }

          /**
           * Handle Range Mousedown and Touchstart
           * @param {Event} e
           */

        }, {
          key: "_handleRangeMousedownTouchstart",
          value: function _handleRangeMousedownTouchstart(e) {
            // Set indicator value
            $(this.value).html(this.$el.val());

            this._mousedown = true;
            this.$el.addClass('active');

            if (!$(this.thumb).hasClass('active')) {
              this._showRangeBubble();
            }

            if (e.type !== 'input') {
              var offsetLeft = this._calcRangeOffset();
              $(this.thumb).addClass('active').css('left', offsetLeft + 'px');
            }
          }

          /**
           * Handle Range Input, Mousemove and Touchmove
           */

        }, {
          key: "_handleRangeInputMousemoveTouchmove",
          value: function _handleRangeInputMousemoveTouchmove() {
            if (this._mousedown) {
              if (!$(this.thumb).hasClass('active')) {
                this._showRangeBubble();
              }

              var offsetLeft = this._calcRangeOffset();
              $(this.thumb).addClass('active').css('left', offsetLeft + 'px');
              $(this.value).html(this.$el.val());
            }
          }

          /**
           * Handle Range Mouseup and Touchend
           */

        }, {
          key: "_handleRangeMouseupTouchend",
          value: function _handleRangeMouseupTouchend() {
            this._mousedown = false;
            this.$el.removeClass('active');
          }

          /**
           * Handle Range Blur, Mouseout and Touchleave
           */

        }, {
          key: "_handleRangeBlurMouseoutTouchleave",
          value: function _handleRangeBlurMouseoutTouchleave() {
            if (!this._mousedown) {
              var paddingLeft = parseInt(this.$el.css('padding-left'));
              var marginLeft = 7 + paddingLeft + 'px';

              if ($(this.thumb).hasClass('active')) {
                anim.remove(this.thumb);
                anim({
                  targets: this.thumb,
                  height: 0,
                  width: 0,
                  top: 10,
                  easing: 'easeOutQuad',
                  marginLeft: marginLeft,
                  duration: 100
                });
              }
              $(this.thumb).removeClass('active');
            }
          }

          /**
           * Setup dropdown
           */

        }, {
          key: "_setupThumb",
          value: function _setupThumb() {
            this.thumb = document.createElement('span');
            this.value = document.createElement('span');
            $(this.thumb).addClass('thumb');
            $(this.value).addClass('value');
            $(this.thumb).append(this.value);
            this.$el.after(this.thumb);
          }

          /**
           * Remove dropdown
           */

        }, {
          key: "_removeThumb",
          value: function _removeThumb() {
            $(this.thumb).remove();
          }

          /**
           * morph thumb into bubble
           */

        }, {
          key: "_showRangeBubble",
          value: function _showRangeBubble() {
            var paddingLeft = parseInt($(this.thumb).parent().css('padding-left'));
            var marginLeft = -7 + paddingLeft + 'px'; // TODO: fix magic number?
            anim.remove(this.thumb);
            anim({
              targets: this.thumb,
              height: 30,
              width: 30,
              top: -30,
              marginLeft: marginLeft,
              duration: 300,
              easing: 'easeOutQuint'
            });
          }

          /**
           * Calculate the offset of the thumb
           * @return {Number}  offset in pixels
           */

        }, {
          key: "_calcRangeOffset",
          value: function _calcRangeOffset() {
            var width = this.$el.width() - 15;
            var max = parseFloat(this.$el.attr('max')) || 100; // Range default max
            var min = parseFloat(this.$el.attr('min')) || 0; // Range default min
            var percent = (parseFloat(this.$el.val()) - min) / (max - min);
            return percent * width;
          }
        }], [{
          key: "init",
          value: function init(els, options) {
            return _get(Range.__proto__ || Object.getPrototypeOf(Range), "init", this).call(this, this, els, options);
          }

          /**
           * Get Instance
           */

        }, {
          key: "getInstance",
          value: function getInstance(el) {
            var domElem = !!el.jquery ? el[0] : el;
            return domElem.M_Range;
          }
        }, {
          key: "defaults",
          get: function () {
            return _defaults;
          }
        }]);

        return Range;
      }(Component);

      M.Range = Range;

      if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Range, 'range', 'M_Range');
      }

      Range.init($('input[type=range]'));
    })(cash, M.anime);
    });

    M.AutoInit();
    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
