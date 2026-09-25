from docx import Document

doc = Document(r"artifacts/proposal-review/reference-copy.docx")
pnum = 0
tidx = 0
for index, child in enumerate(doc.element.body):
    tag = child.tag.split("}")[-1]
    text = "".join(child.itertext()).strip().replace("\n", " ")[:120]
    if tag == "p":
        print(index, "P", pnum, repr(text))
        pnum += 1
    elif tag == "tbl":
        print(index, "T", tidx, repr(text))
        tidx += 1
    else:
        print(index, tag, repr(text))
