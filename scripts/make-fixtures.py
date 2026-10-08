"""수동 브라우저 검증용 예제 파일. Python Pillow/openpyxl이 필요합니다."""
from pathlib import Path
from PIL import Image, ImageDraw
from PIL.TiffImagePlugin import IFDRational
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.drawing.image import Image as ExcelImage
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED

out = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
out.mkdir(parents=True, exist_ok=True)
image = Image.new("RGB", (1100, 720), "#dfe8ff")
draw = ImageDraw.Draw(image)
for i in range(180):
    draw.rectangle((i * 7 % 1100, i * 19 % 720, (i * 7 % 1100) + 90, (i * 19 % 720) + 45), fill=(i * 23 % 255, i * 47 % 255, i * 89 % 255))
image.save(out / "sample.jpg", quality=95)
image.save(out / "sample.png")

transparent = Image.new("RGBA", (80, 60), (0, 0, 0, 0))
ImageDraw.Draw(transparent).rectangle((20, 15, 59, 44), fill=(255, 0, 0, 255))
transparent.save(out / "transparent.png")
transparent.save(out / "transparent.webp", lossless=True)

exif = Image.Exif()
exif[271] = "Kymi QA Camera"
exif[272] = "Kymi QA Model"
exif[34853] = {
    1: "N", 2: (IFDRational(37, 1), IFDRational(33, 1), IFDRational(0, 1)),
    3: "E", 4: (IFDRational(127, 1), IFDRational(0, 1), IFDRational(0, 1)),
}
image.save(out / "with-gps.jpg", exif=exif)
oriented = Image.new("RGB", (80, 40), "red")
ImageDraw.Draw(oriented).rectangle((40, 0, 79, 39), fill="blue")
orientation = Image.Exif()
orientation[274] = 6
oriented.save(out / "oriented.jpg", exif=orientation)
Image.new("RGB", (1, 1), "red").save(out / "tiny.jpg")
(out / "corrupt.jpg").write_bytes(b"\xff\xd8\xff" + b"not-a-real-jpeg")
Image.new("RGB", (32, 32), "red").save(
    out / "animated.webp", save_all=True,
    append_images=[Image.new("RGB", (32, 32), "blue")], duration=100, loop=0,
)

wb = Workbook()
ws = wb.active
ws.title = "한글 시트"
for row in range(1, 260):
    for col in range(1, 15):
        ws.cell(row, col, "반복 자료 " + str(row % 9))
ws["P1"] = "=SUM(1,2)"
wb.save(out / "sample.xlsx")
with ZipFile(out / "sample.xlsx") as source, ZipFile(out / "stored.xlsx", "w", ZIP_STORED) as target:
    for part in source.infolist():
        target.writestr(part.filename, source.read(part.filename), compress_type=ZIP_STORED)
with ZipFile(out / "sample.xlsx") as source, ZipFile(out / "stored-with-dirs.xlsx", "w", ZIP_STORED) as target:
    target.writestr("xl/", b"")
    target.writestr("xl/worksheets/", b"")
    for part in source.infolist():
        target.writestr(part.filename, source.read(part.filename), compress_type=ZIP_STORED)
(out / "invalid.xlsx").write_bytes(b"PK\x03\x04" + b"broken")

complex_book = Workbook()
data = complex_book.active
data.title = "공개 시트"
data["A1"] = "항목"
data["B1"] = "값"
for row in range(2, 12):
    data.cell(row, 1, f"값 {row}")
    data.cell(row, 2, row * 3)
data["D2"] = "=SUM(B2:B11)"
data.merge_cells("D4:E4")
data["D4"] = "병합된 셀"
chart = BarChart()
chart.add_data(Reference(data, min_col=2, min_row=1, max_row=11), titles_from_data=True)
data.add_chart(chart, "F2")
data.add_image(ExcelImage(out / "transparent.png"), "J2")
hidden = complex_book.create_sheet("숨김 시트")
hidden.sheet_state = "hidden"
hidden["A1"] = "보존할 데이터"
complex_book.save(out / "complex.xlsx")
with ZipFile(out / "complex.xlsx") as source, ZipFile(out / "complex-stored.xlsx", "w", ZIP_STORED) as target:
    for part in source.infolist():
        target.writestr(part.filename, source.read(part.filename), compress_type=ZIP_STORED)
with ZipFile(out / "sample.xlsx") as source, ZipFile(out / "macro-disguised.xlsx", "w", ZIP_DEFLATED) as target:
    for part in source.infolist():
        target.writestr(part.filename, source.read(part.filename))
    target.writestr("xl/vbaProject.bin", b"macro sentinel")
with ZipFile(out / "sample.xlsx") as source, ZipFile(out / "bomb.xlsx", "w", ZIP_DEFLATED) as target:
    for part in source.infolist():
        target.writestr(part.filename, source.read(part.filename))
    target.writestr("xl/worksheets/bomb.xml", b"0" * 3_000_000)
print(out)
