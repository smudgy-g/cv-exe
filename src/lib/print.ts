// Page breaks for the printed copy, decided before window.print() so that a job split across two pages
// can repeat its title ("Lead Developer (continued)") at the top of the next page.
// We lay the copy out at A4 content width, walk its blocks in order and force a break before the first
// block that would overflow each page; forcing every break keeps the browser's pages the same as ours.

const MM_TO_PX = 96 / 25.4;
const PAGE_MARGIN_MM = 14; // same as @page in app.css
const PAGE_WIDTH_PX = (210 - 2 * PAGE_MARGIN_MM) * MM_TO_PX;

// ponytail: small safety gap for rounding between screen layout and print; raise it if a bullet ever
// lands alone at the bottom of a page without its "(continued)" heading.
const PAGE_HEIGHT_PX = (297 - 2 * PAGE_MARGIN_MM) * MM_TO_PX - 4;

// Blocks the browser never splits (lines of text, headings, job dates, the cover-letter page break).
const UNBREAKABLE = 'li, p, h1, h2, h3, .headline, .contact, .meta, .details, .pagebreak, .lhead, .ldate, .lsubj';

// Kept with the block after them (break-after: avoid in app.css).
const KEEP_WITH_NEXT = 'h1, h2, h3, .headline, .contact, .meta';

const topOf = (element: HTMLElement) =>
	element.getBoundingClientRect().top - parseFloat(getComputedStyle(element).marginTop);

/** Splits a job's bullet list before `bullet` and puts "Job title (continued)" above the second half. */
function continueJob(job: Element, bullet: HTMLElement, continuedLabel: string): HTMLElement {
	const list = bullet.parentElement!;
	const remainingList = document.createElement('ul');

	for (let item: Element | null = bullet; item; ) {
		const nextItem: Element | null = item.nextElementSibling;

		remainingList.append(item);
		item = nextItem;
	}

	const heading = document.createElement('h3');

	heading.className = 'continued';
	heading.textContent = `${job.querySelector('h3')?.textContent?.trim() ?? ''} ${continuedLabel}`;
	list.after(heading, remainingList);

	return heading;
}

/** Forces A4 page breaks into `container` (the #print copy, already filled and styled). */
export function paginate(container: HTMLElement, continuedLabel: string): void {
	// #print is display:none on screen; lay it out invisibly at print width to measure it.
	container.style.cssText = `display:block;visibility:hidden;position:absolute;left:0;top:0;width:${PAGE_WIDTH_PX}px`;

	const blocks = [...container.querySelectorAll<HTMLElement>(UNBREAKABLE)].filter(
		(block) => !block.parentElement?.closest(UNBREAKABLE)
	);

	let pageTop = container.getBoundingClientRect().top;

	for (let index = 0; index < blocks.length; index++) {
		const block = blocks[index];

		if (block.classList.contains('pagebreak')) {
			pageTop = block.getBoundingClientRect().bottom;
			continue;
		}

		if (block.getBoundingClientRect().bottom - pageTop <= PAGE_HEIGHT_PX) continue;

		// Headings and dates move to the next page together with the block they introduce.
		let breakIndex = index;

		while (breakIndex > 0 && blocks[breakIndex - 1].matches(KEEP_WITH_NEXT) && topOf(blocks[breakIndex - 1]) > pageTop) {
			breakIndex--;
		}

		let breakBlock = blocks[breakIndex];

		if (topOf(breakBlock) <= pageTop) continue; // taller than a page on its own: let the browser split it

		const job = breakBlock.closest('.job');

		if (job && breakBlock.tagName === 'LI' && breakBlock.previousElementSibling) {
			breakBlock = continueJob(job, breakBlock, continuedLabel);
		}

		breakBlock.style.breakBefore = 'page';
		pageTop = topOf(breakBlock);
	}

	container.style.cssText = '';
}
