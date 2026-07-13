from unittest.mock import patch
import json

from bs4 import BeautifulSoup
import pytest

from seahub.chats.utils import (
    extract_discourse_posts,
    extract_GitHub_issues,
    extract_other_page_info,
    _extract_github_issue_title,
    _extract_github_issue_metadata,
    _extract_github_issue,
    _extract_github_comments,
)


def _discourse_html(fancy_title, posts):
    """Build a Discourse forum page HTML snippet.

    fancy_title: text inside <a class="fancy-title">
    posts: list of dicts with keys author, time, content.
    """
    parts = []
    if fancy_title:
        parts.append(f'<a class="fancy-title">{fancy_title}</a>')
    for post in posts:
        parts.append(f'''
        <article>
            <div class="names">
                <span class="username"><a>{post["author"]}</a></span>
            </div>
            <div class="post-date">
                <span class="relative-date" title="{post["time"]}"></span>
            </div>
            <div class="cooked">{post["content"]}</div>
        </article>
        ''')
    return '<html><body>' + ''.join(parts) + '</body></html>'


def _github_html(title='', issue_number='', state='', author='',
                 post_time='', issue_content='', comments=None):
    """Build a GitHub issue page HTML snippet."""
    parts = ['<html><body>']

    if title:
        parts.append(f'<h1 data-testid="issue-title">{title}</h1>')

    if issue_number or state:
        parts.append('<div data-testid="issue-header">')
        if issue_number:
            parts.append(f'<span>{issue_number}</span>')
        if state:
            parts.append(f'<span class="State">{state}</span>')
        parts.append('</div>')

    parts.append('<div data-testid="issue-body">')
    if author:
        parts.append(f'<a data-hovercard-type="user">{author}</a>')
    if post_time:
        parts.append(f'<relative-time datetime="{post_time}"></relative-time>')
    if issue_content:
        parts.append(f'<div data-testid="markdown-body">{issue_content}</div>')
    parts.append('</div>')

    if comments:
        parts.append('<div data-testid="issue-viewer-comments-container">')
        for idx, c in enumerate(comments):
            parts.append(f'''
            <div data-timeline-event-id="{idx}">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">{c["author"]}</a>
                <relative-time datetime="{c["time"]}"></relative-time>
                <div data-testid="markdown-body">{c["content"]}</div>
            </div>
            ''')
        parts.append('</div>')

    parts.append('</body></html>')
    return ''.join(parts)


class TestExtractDiscoursePosts:

    FANCY_TITLE = 'Welcome to the forum'
    URL = 'https://forum.example.com/t/123'

    def test_single_post(self):
        html = _discourse_html(
            fancy_title=self.FANCY_TITLE,
            posts=[{'author': 'alice', 'time': '2025-01-01', 'content': 'Hello world'}]
        )
        text, title = extract_discourse_posts(html, 'Page Title', self.URL)
        assert title == self.FANCY_TITLE
        assert 'alice' in text
        assert f'create a topic about {self.FANCY_TITLE}' in text
        assert '2025-01-01' in text
        assert 'Hello world' in text

    def test_multiple_posts(self):
        html = _discourse_html(
            fancy_title='Bug report',
            posts=[
                {'author': 'alice', 'time': '2025-01-01', 'content': 'Found a bug'},
                {'author': 'bob', 'time': '2025-01-02', 'content': 'I can reproduce'},
            ]
        )
        text, title = extract_discourse_posts(html, 'ignored', self.URL)
        assert title == 'Bug report'
        assert 'alice create a topic about Bug report on 2025-01-01, stating: Found a bug.' in text
        assert 'bob replied on 2025-01-02 with: I can reproduce.' in text

    def test_title_fallback_to_param(self):
        """When fancy-title is missing, the title param is used as fallback."""
        html = _discourse_html(
            fancy_title='',
            posts=[{'author': 'alice', 'time': '2025-01-01', 'content': 'Hello'}]
        )
        text, title = extract_discourse_posts(html, 'Fallback Title', self.URL)
        assert title == 'Fallback Title'
        assert 'Fallback Title' in text

    def test_no_posts_falls_back_to_other_page_info(self):
        """Zero posts -> delegates to extract_other_page_info."""
        html = _discourse_html(fancy_title='Empty thread', posts=[])
        with patch('seahub.chats.utils.extract_other_page_info',
                   return_value=('extracted text', 'extracted title')) as mock:
            text, title = extract_discourse_posts(html, 'ignored', self.URL)
        mock.assert_called_once_with(html, 'Empty thread', self.URL)
        assert text == 'extracted text'
        assert title == 'extracted title'

    def test_empty_html_falls_back_to_other_page_info(self):
        html = '<html><body></body></html>'
        with patch('seahub.chats.utils.extract_other_page_info',
                   return_value=('extracted text', 'param title')) as mock:
            text, title = extract_discourse_posts(html, 'param title', self.URL)
        mock.assert_called_once_with(html, 'param title', self.URL)
        assert text == 'extracted text'
        assert title == 'param title'

    def test_missing_author(self):
        """Post without a .names .username a element."""
        html = '''
        <html><body>
        <a class="fancy-title">Topic</a>
        <article>
            <div class="post-date">
                <span class="relative-date" title="2025-01-01"></span>
            </div>
            <div class="cooked">No author here</div>
        </article>
        </body></html>
        '''
        text, title = extract_discourse_posts(html, 'ignored', self.URL)
        assert title == 'Topic'
        assert 'Unknown user' in text
        assert 'No author here' in text

    def test_missing_time(self):
        """Post without a .post-date .relative-date element."""
        html = '''
        <html><body>
        <a class="fancy-title">Topic</a>
        <article>
            <div class="names">
                <span class="username"><a>alice</a></span>
            </div>
            <div class="cooked">No time here</div>
        </article>
        </body></html>
        '''
        text, title = extract_discourse_posts(html, 'ignored', self.URL)
        assert title == 'Topic'
        assert 'alice' in text
        assert 'No time here' in text

    def test_post_with_quoted_content_stripped(self):
        """aside.quote blocks should be removed from post content."""
        html = '''
        <html><body>
        <a class="fancy-title">Discussion</a>
        <article>
            <div class="names">
                <span class="username"><a>alice</a></span>
            </div>
            <div class="post-date">
                <span class="relative-date" title="2025-01-01"></span>
            </div>
            <div class="cooked">
                Main content
                <aside class="quote">Quoted text to remove</aside>
                More text
            </div>
        </article>
        </body></html>
        '''
        text, title = extract_discourse_posts(html, 'ignored', self.URL)
        assert 'Quoted text to remove' not in text
        assert 'Main content' in text
        assert 'More text' in text

    def test_post_without_parent_article(self):
        """cooked div without an <article> parent falls back to Unknown user."""
        html = '''
        <html><body>
        <a class="fancy-title">Topic</a>
        <div class="cooked">Orphan post content</div>
        </body></html>
        '''
        text, title = extract_discourse_posts(html, 'ignored', self.URL)
        assert 'Orphan post content' in text
        assert 'Unknown user' in text


class TestExtractOtherPageInfo:

    URL = 'https://example.com/page'

    def test_successful_extraction(self):
        html = '<html><body><p>Hello world</p></body></html>'
        mock_result = json.dumps({'text': 'Hello world', 'excerpt': 'Hello'})

        with patch('seahub.chats.utils.extract', return_value=mock_result) as mock_extract:
            text, title = extract_other_page_info(html, 'My Title', self.URL)

        mock_extract.assert_called_once_with(
            html, output_format='json', favor_recall=True, include_tables=True)
        assert title == 'My Title'
        assert 'Text: Hello world' in text
        assert 'Excerpt: Hello' in text

    def test_extraction_failure_returns_url(self):
        html = '<html><body>bad</body></html>'

        with patch('seahub.chats.utils.extract', side_effect=Exception('parse error')):
            text, title = extract_other_page_info(html, 'My Title', self.URL)

        assert text == self.URL
        assert title == 'My Title'

    def test_empty_json_fallback(self):
        html = '<html><body></body></html>'

        with patch('seahub.chats.utils.extract', return_value=None):
            text, title = extract_other_page_info(html, 'T', self.URL)

        assert 'Text: ' in text
        assert 'Excerpt: ' in text
        assert title == 'T'


class TestExtractGitHubIssues:

    URL = 'https://github.com/org/repo/issues/1'
    TITLE_PARAM = 'Issue title from param'

    def test_single_issue_no_comments(self):
        html = _github_html(
            title='Fix login bug',
            issue_number='#42',
            state='Open',
            author='dev1',
            post_time='2025-03-01T10:00:00Z',
            issue_content='The login page crashes on submit.',
        )
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == 'Fix login bug'
        assert 'dev1' in text
        assert 'opened an issue about Fix login bug' in text
        assert 'The login page crashes on submit.' in text

    def test_issue_with_comments(self):
        html = _github_html(
            title='Add dark mode',
            issue_number='#100',
            state='Open',
            author='alice',
            post_time='2025-04-01T12:00:00Z',
            issue_content='Would be nice to have dark mode.',
            comments=[
                {'author': 'bob', 'time': '2025-04-02T08:00:00Z',
                 'content': 'I can work on this.'},
                {'author': 'charlie', 'time': '2025-04-03T09:00:00Z',
                 'content': '+1 from me.'},
            ]
        )
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == 'Add dark mode'
        assert 'alice opened an issue about Add dark mode' in text
        assert 'Would be nice to have dark mode.' in text
        assert 'bob replied on 2025-04-02T08:00:00Z with: I can work on this.' in text
        assert 'charlie replied on 2025-04-03T09:00:00Z with: +1 from me.' in text

    def test_minimal_html_with_only_title(self):
        """Issue page with only a title h1 and nothing else."""
        html = '<html><body><h1 data-testid="issue-title">Minimal</h1></body></html>'
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == 'Minimal'
        assert 'opened an issue about Minimal' in text
        assert 'unknown' in text

    def test_empty_html(self):
        """Empty HTML still produces a default formatted string."""
        html = ''
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == ''
        assert 'unknown opened an issue' in text

    def test_malformed_html(self):
        """Even with broken HTML, BeautifulSoup should handle it gracefully."""
        html = '<h1 data-testid="issue-title">Broken'
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == 'Broken'
        assert isinstance(text, str)

    def test_issue_metadata_extraction(self):
        html = _github_html(
            title='Enhance performance',
            issue_number='#200',
            state='Closed',
            author='dev',
            post_time='2025-05-01',
            issue_content='Slow queries in dashboard.',
        )
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == 'Enhance performance'
        assert 'dev opened an issue about Enhance performance' in text
        assert 'Slow queries in dashboard.' in text

    def test_comments_with_missing_author(self):
        """Comment without an author element defaults to 'unknown'."""
        html = '''
        <html><body>
        <h1 data-testid="issue-title">Issue</h1>
        <div data-testid="issue-body">
            <a data-hovercard-type="user">alice</a>
            <relative-time datetime="2025-01-01"></relative-time>
            <div data-testid="markdown-body">body</div>
        </div>
        <div data-testid="issue-viewer-comments-container">
            <div data-timeline-event-id="1">
                <div data-testid="comment-header"></div>
                <relative-time datetime="2025-01-02"></relative-time>
                <div data-testid="markdown-body">anonymous reply</div>
            </div>
        </div>
        </body></html>
        '''
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert 'anonymous reply' in text
        assert 'unknown replied' in text

    def test_html_without_issue_body(self):
        """HTML that has a title but no issue body at all."""
        html = '<html><body><h1 data-testid="issue-title">Title only</h1></body></html>'
        text, title = extract_GitHub_issues(html, self.TITLE_PARAM, self.URL)
        assert title == 'Title only'
        assert isinstance(text, str)


class TestExtractGitHubIssueTitle:

    def test_data_testid_selector(self):
        soup = BeautifulSoup(
            '<h1 data-testid="issue-title">Primary title</h1>', 'html.parser')
        assert _extract_github_issue_title(soup) == 'Primary title'

    def test_gh_header_title_fallback(self):
        soup = BeautifulSoup(
            '<h1 class="gh-header-title">Fallback title</h1>', 'html.parser')
        assert _extract_github_issue_title(soup) == 'Fallback title'

    def test_issue_header_h1_fallback(self):
        soup = BeautifulSoup(
            '<div data-testid="issue-header"><h1>Header title</h1></div>',
            'html.parser')
        assert _extract_github_issue_title(soup) == 'Header title'

    def test_bdi_fallback(self):
        soup = BeautifulSoup('<bdi>BDI title</bdi>', 'html.parser')
        assert _extract_github_issue_title(soup) == 'BDI title'

    def test_first_h1_fallback(self):
        soup = BeautifulSoup('<h1>Last resort</h1>', 'html.parser')
        assert _extract_github_issue_title(soup) == 'Last resort'

    def test_no_title_found(self):
        soup = BeautifulSoup('<div>no title here</div>', 'html.parser')
        assert _extract_github_issue_title(soup) == ''


class TestExtractGitHubIssueMetadata:

    def test_issue_number_and_state(self):
        soup = BeautifulSoup(
            '<div data-testid="issue-header">'
            '  <span>#42</span>'
            '  <span class="State">Open</span>'
            '</div>',
            'html.parser')
        meta = _extract_github_issue_metadata(soup)
        assert meta['issue_number'] == '#42'
        assert meta['state'] == 'Open'

    def test_labels_extraction(self):
        soup = BeautifulSoup(
            '<div data-testid="issue-header">'
            '  <span>#1</span>'
            '  <span class="State">Closed</span>'
            '  <a class="Label">bug</a>'
            '  <a class="Label">priority</a>'
            '</div>',
            'html.parser')
        meta = _extract_github_issue_metadata(soup)
        assert 'bug' in meta['labels']
        assert 'priority' in meta['labels']
        assert 'Closed' not in meta['labels']  # state not duplicated

    def test_assignees_extraction(self):
        soup = BeautifulSoup(
            '<div data-testid="issue-header">'
            '  <a class="avatar-link" title="alice"></a>'
            '  <a class="avatar-link" title="bob"></a>'
            '</div>',
            'html.parser')
        meta = _extract_github_issue_metadata(soup)
        assert meta['assignees'] == ['alice', 'bob']

    def test_empty_header(self):
        soup = BeautifulSoup('<div></div>', 'html.parser')
        meta = _extract_github_issue_metadata(soup)
        assert meta['issue_number'] == ''
        assert meta['state'] == ''
        assert meta['labels'] == []
        assert meta['assignees'] == []


class TestExtractGitHubIssue:

    def test_full_issue(self):
        html = _github_html(
            title='Test title',
            issue_number='#99',
            state='Open',
            author='testuser',
            post_time='2025-06-01',
            issue_content='This is the body.',
        )
        soup = BeautifulSoup(html, 'html.parser')
        info = _extract_github_issue(soup)
        assert info['title'] == 'Test title'
        assert info['issue_number'] == '#99'
        assert info['state'] == 'Open'
        assert info['author'] == 'testuser'
        assert info['time'] == '2025-06-01'
        assert info['content'] == 'This is the body.'

    def test_minimal_issue(self):
        soup = BeautifulSoup(
            '<h1 data-testid="issue-title">Min</h1>', 'html.parser')
        info = _extract_github_issue(soup)
        assert info['title'] == 'Min'
        assert info['author'] == 'unknown'
        assert info['content'] == ''


class TestExtractGitHubComments:

    def test_single_comment(self):
        html = '''
        <html><body>
        <div data-testid="issue-viewer-comments-container">
            <div data-timeline-event-id="1">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">commenter</a>
                <relative-time datetime="2025-07-01"></relative-time>
                <div data-testid="markdown-body">Great idea!</div>
            </div>
        </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert len(comments) == 1
        assert comments[0]['author'] == 'commenter'
        assert comments[0]['time'] == '2025-07-01'
        assert comments[0]['content'] == 'Great idea!'

    def test_multiple_comments(self):
        html = '''
        <html><body>
        <div data-testid="issue-viewer-comments-container">
            <div data-timeline-event-id="1">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">u1</a>
                <relative-time datetime="2025-01-01"></relative-time>
                <div data-testid="markdown-body">First</div>
            </div>
            <div data-timeline-event-id="2">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">u2</a>
                <relative-time datetime="2025-01-02"></relative-time>
                <div data-testid="markdown-body">Second</div>
            </div>
        </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert len(comments) == 2
        assert comments[0]['content'] == 'First'
        assert comments[1]['content'] == 'Second'

    def test_no_comments_container(self):
        """Comments inside data-timeline-event-id divs without a container."""
        html = '''
        <html><body>
            <div data-timeline-event-id="1">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">u</a>
                <relative-time datetime="t"></relative-time>
                <div data-testid="markdown-body">c</div>
            </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert len(comments) == 1
        assert comments[0]['content'] == 'c'

    def test_empty_comments(self):
        html = '<html><body></body></html>'
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert comments == []

    def test_filters_commit_reference(self):
        """System event 'added N commits that reference this issue' is excluded."""
        html = '''
        <html><body>
        <div data-testid="issue-viewer-comments-container">
            <div data-timeline-event-id="1">
                <a data-hovercard-type="user">dev1</a>
                <relative-time datetime="2025-01-01"></relative-time>
                <div data-testid="markdown-body">Fixed the bug in abc123</div>
                <div data-testid="commit-ref">added 2 commits</div>
            </div>
        </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert comments == []

    def test_filters_label_event(self):
        """Label change events (.labels-timeline-item) are excluded."""
        html = '''
        <html><body>
        <div data-testid="issue-viewer-comments-container">
            <div data-timeline-event-id="1" class="labels-timeline-item">
                <a data-hovercard-type="user">bot</a>
                <span class="IssueLabel">bug</span>
                <span class="IssueLabel">priority</span>
            </div>
        </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert comments == []

    def test_filters_cross_reference(self):
        """Cross-reference events are excluded."""
        html = '''
        <html><body>
        <div data-testid="issue-viewer-comments-container">
            <div data-timeline-event-id="1" class="cross-reference">
                mentioned this issue
            </div>
        </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert comments == []

    def test_mixed_real_comments_and_system_events(self):
        """Only real user comments pass through; system events are skipped."""
        html = '''
        <html><body>
        <div data-testid="issue-viewer-comments-container">
            <!-- system event: label change -->
            <div data-timeline-event-id="1" class="labels-timeline-item">
                <span class="IssueLabel">bug</span>
            </div>
            <!-- real comment -->
            <div data-timeline-event-id="2">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">alice</a>
                <relative-time datetime="2025-01-01"></relative-time>
                <div data-testid="markdown-body">good point</div>
            </div>
            <!-- system event: commit ref -->
            <div data-timeline-event-id="3">
                <div data-testid="commit-ref">added 1 commit</div>
            </div>
            <!-- real comment -->
            <div data-timeline-event-id="4">
                <div data-testid="comment-header"></div>
                <a data-hovercard-type="user">bob</a>
                <relative-time datetime="2025-01-02"></relative-time>
                <div data-testid="markdown-body">+1</div>
            </div>
        </div>
        </body></html>
        '''
        soup = BeautifulSoup(html, 'html.parser')
        comments = _extract_github_comments(soup)
        assert len(comments) == 2
        assert comments[0]['author'] == 'alice'
        assert comments[0]['content'] == 'good point'
        assert comments[1]['author'] == 'bob'
        assert comments[1]['content'] == '+1'
