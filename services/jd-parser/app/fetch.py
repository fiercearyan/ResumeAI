import httpx
import trafilatura


async def fetch_url_text(url: str) -> str:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as client:
        r = await client.get(url)
        r.raise_for_status()
        html = r.text
    extracted = trafilatura.extract(
        html,
        include_tables=False,
        include_comments=False,
        favor_recall=True,
    )
    if not extracted:
        # Fallback: crude stripping.
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        extracted = soup.get_text(separator="\n")
    return extracted.strip()
