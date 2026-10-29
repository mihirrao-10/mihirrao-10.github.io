import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parse } from 'parse5';
import { contentContract, all, attr, hasClass, text, normalize } from './contract.js';
const root = new URL('../../', import.meta.url);

async function document() { return parse(await fs.readFile(new URL('index.html', root), 'utf8')); }

test('concise content matches the authorized revision and retains its destinations', async () => {
  const html = await fs.readFile(new URL('index.html', root), 'utf8');
  const baseline = JSON.parse(await fs.readFile(new URL('fixtures/content-baseline.json', import.meta.url), 'utf8'));
  assert.deepEqual(contentContract(html), baseline);
});

test('the seven main links reach one complete page each, without secondary controls', async () => {
  const doc = await document();
  const scenes = all(doc, node => attr(node, 'data-scene'));
  assert.deepEqual(scenes.map(node => attr(node, 'id')), ['top', 'education', 'experience', 'publications', 'teaching', 'personal-projects', 'notes']);
  const index = all(doc, node => hasClass(node, 'site-index'))[0];
  const links = all(index, node => node.tagName === 'a');
  assert.deepEqual(links.map(node => normalize(text(node))), ['About', 'Education', 'Industry experience', 'Publications', 'Teaching', 'Projects', 'Personal notes']);
  assert.deepEqual(links.map(node => attr(node, 'href')), scenes.map(node => `#${attr(node, 'id')}`));
  assert.equal(new Set(scenes.map(node => attr(node, 'data-target'))).size, 7);
  assert.equal(links.filter(node => attr(node, 'aria-current') === 'page').length, 1);
  assert.equal(all(doc, node => ['page-index', 'detail-pagination', 'education-pagination', 'scene-next'].some(name => hasClass(node, name))).length, 0);
  for (const id of ['education', 'experience', 'personal-projects']) {
    const page = scenes.find(node => attr(node, 'id') === id);
    assert.equal(all(page, node => hasClass(node, 'entry')).length, 2);
    assert.ok(normalize(text(page)).split(/\s+/).length < (id === 'personal-projects' ? 100 : 65), `${id} remains a short page`);
  }
});

test('projects keep their direct links and the interface adds no detail buttons', async () => {
  const doc = await document();
  const projects = all(doc, node => attr(node, 'id') === 'personal-projects')[0];
  const links = all(projects, node => node.tagName === 'a');
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.equal(attr(link, 'target'), '_blank');
    assert.ok(attr(link, 'rel').split(/\s+/).includes('noopener'));
  }
  const buttons = all(doc, node => node.tagName === 'button');
  assert.equal(buttons.length, 1);
  assert.ok(hasClass(buttons[0], 'animation-action'));
  assert.equal(attr(buttons[0], 'hidden'), '');
});

test('generated notes remain unique links to real PDFs in non-empty groups', async () => {
  const doc = await document();
  assert.equal(all(doc, node => node.tagName === 'h1').length, 1);
  assert.equal(all(doc, node => node.tagName === 'main').length, 1);
  const notes = all(doc, node => attr(node, 'id') === 'notes')[0];
  const cards = all(notes, node => hasClass(node, 'note'));
  const links = all(notes, node => node.tagName === 'a');
  assert.equal(links.length, cards.length);
  assert.equal(new Set(links.map(node => attr(node, 'href'))).size, links.length);
  for (const link of links) {
    assert.ok(hasClass(link, 'note-link'));
    assert.match(attr(link, 'href'), /^notes\/[a-z0-9-]+\.pdf$/);
    await fs.access(new URL(attr(link, 'href'), root));
  }
  for (const group of all(notes, node => hasClass(node, 'notes-group')))
    assert.ok(all(group, node => hasClass(node, 'note')).length > 0);
});

test('education and employment use separate month ranges and the requested teams', async () => {
  const doc = await document();
  const dates = all(doc, node => hasClass(node, 'entry-dates'));
  assert.deepEqual(dates.map(node => normalize(text(node))), [
    'Sept 2025 - Dec 2026', 'Sept 2020 - Jun 2025',
    'Jun 2026 - Sept 2026', 'Apr 2024 - Sept 2024',
  ]);
  for (const date of dates) assert.equal(all(date, node => node.tagName === 'time').length, 2);
  assert.equal(all(doc, node => hasClass(node, 'hero-description')).length, 0);
  const education = all(doc, node => attr(node, 'id') === 'education')[0];
  assert.doesNotMatch(text(education), /Foundations|specialization/i);
  const experience = all(doc, node => attr(node, 'id') === 'experience')[0];
  assert.deepEqual(all(experience, node => hasClass(node, 'entry-detail')).map(node => normalize(text(node))),
    ['MATLAB Data Analysis team', 'Investment Process Engineering team']);
});

test('new sections include publication status, teaching courses, locations, and book subtitles', async () => {
  const doc = await document();
  const publication = all(doc, node => attr(node, 'id') === 'publications')[0];
  assert.match(text(publication), /Coming soon\.\.\./);
  assert.equal(all(doc, node => hasClass(node, 'entry-location')).length, 4);
  const teaching = all(doc, node => attr(node, 'id') === 'teaching')[0];
  assert.equal(all(teaching, node => node.tagName === 'li').length, 7);
  assert.equal(all(doc, node => hasClass(node, 'section-description')).length, 7);
  for (const note of all(doc, node => hasClass(node, 'note')))
    assert.ok(normalize(text(all(note, node => hasClass(node, 'note-byline'))[0])).length > 10);
});
