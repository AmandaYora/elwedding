// ============================================
// FLOATING UI POPOVER - SINGLE ELEMENT REUSE
// ============================================
import {
    computePosition,
    offset,
    flip,
    shift,
    autoUpdate,
    autoPlacement
} from 'https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.7.4/+esm';

(function (window, $) {
    let currentPopover = null;
    let singlePopoverEl = null;

    function createPopover(referenceEl, floatingElOrContent, options) {
        const config = $.extend({
            placement: 'bottom',
            offset: 8,
            trigger: 'click',
            parent: 'body'
        }, options);

        let cleanup = null;
        let open = false;

        const $parent = $(config.parent);
        
        // ← FIX: Create element dengan proper null checks
        let floatingEl;
        if (!singlePopoverEl) {
            if (typeof floatingElOrContent === 'function') {
                const html = floatingElOrContent();
                const $temp = $('<div>').html(html);
                floatingEl = $temp.children().first()[0];
            } else if (typeof floatingElOrContent === 'string') {
                const $temp = $('<div>').html(floatingElOrContent);
                floatingEl = $temp.children().first()[0];
            } else {
                floatingEl = $(floatingElOrContent).clone()[0];
            }
            
            // ← FIX: Check if element creation failed
            if (!floatingEl) {
                console.error('Failed to create popover element');
                return { show: () => {}, hide: () => {}, toggle: () => {} };
            }
            
            $(floatingEl).css({
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'none',
                zIndex: 999999,
                width: 'max-content'
            }).appendTo($parent);
            
            singlePopoverEl = floatingEl;
        } else {
            floatingEl = singlePopoverEl;
        }

        const contentProvider = floatingElOrContent;

        function update() {
            computePosition(referenceEl, floatingEl, {
                placement: config.placement,
                middleware: [
                    offset(config.offset),
                    flip(),
                    autoPlacement(),
                    shift({ padding: 8 })
                ]
            }).then(({ x, y }) => {
                floatingEl.style.left = `${x}px`;
                floatingEl.style.top = `${y}px`;
            });
        }

        function show() {
            if (open) return;
            
            if (currentPopover && currentPopover !== instance) {
                currentPopover.hide();
            }
            
            // ← FIX: Update content dengan null check
            if (typeof contentProvider === 'function') {
                const newContent = contentProvider();
                if (newContent) {
                    const $temp = $('<div>').html(newContent);
                    const $newBody = $temp.find('.dreamboard-popover-body');
                    const $currentBody = $(floatingEl).find('.dreamboard-popover-body');
                    
                    if ($newBody.length && $currentBody.length) {
                        $currentBody.html($newBody.html());
                    } else {
                        // Fallback: replace entire content
                        $(floatingEl).html($temp.children().first().html());
                    }
                }
            } else if (typeof contentProvider === 'string') {
                $(floatingEl).html(contentProvider);
            }
            
            $(floatingEl).show();
            cleanup = autoUpdate(referenceEl, floatingEl, update);
            update();
            open = true;
            currentPopover = instance;
        }

        function hide() {
            if (!open) return;
            $(floatingEl).hide();
            cleanup && cleanup();
            cleanup = null;
            open = false;
            if (currentPopover === instance) {
                currentPopover = null;
            }
        }

        function toggle() {
            open ? hide() : show();
        }

        const instance = { show, hide, toggle };

        if (config.trigger === 'hover') {
            $(referenceEl).on('mouseenter', show);
            $(referenceEl).on('mouseleave', hide);
            $(floatingEl).on('mouseenter', show);
            $(floatingEl).on('mouseleave', hide);
        } else {
            $(referenceEl).on('click', function (e) {
                e.stopPropagation();
                toggle();
            });

            // ← FIX: Add null checks
            $(document).on('click', function (e) {
                if (!referenceEl || !floatingEl) return;
                if (
                    referenceEl.contains(e.target) ||
                    floatingEl.contains(e.target)
                ) return;
                hide();
            });
        }

        $(document).on('keydown', e => {
            if (e.key === 'Escape') hide();
        });

        $(floatingEl).on('click', '[data-popover-close]', hide);

        return instance;
    }

    function initPopovers() {
        $('[data-popover]').each(function () {
            if (this.__popover) return;

            const $trigger = $(this);
            const tplSelector = $trigger.data('popover');
            const $tpl = $(tplSelector);

            if (!$tpl.length) return;

            const content = $tpl.prop('content')
                ? $($tpl.prop('content')).children().first().clone()
                : $tpl.clone();

            this.__popover = createPopover(this, content[0], {
                placement: $trigger.data('placement'),
                offset: $trigger.data('offset'),
                trigger: $trigger.data('trigger'),
                parent: $trigger.data('parent') || 'body'
            });
        });
    }

    window.DreamboardPopover = {
        init: initPopovers,
        create: createPopover
    };
    
    DreamboardPopover.init();
})(window, window.jQuery);