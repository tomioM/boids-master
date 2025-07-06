const batchID = Math.round(Math.random()*1000)
let counter = 0;



function exportCanvasAsPNG(id, fileName) {

    var canvasElement = document.getElementById(id);

    var MIME_TYPE = "image/png";

    var imgURL = canvasElement.toDataURL(MIME_TYPE);

    var dlLink = document.createElement('a');
    dlLink.download = fileName;
    dlLink.href = imgURL;
    dlLink.dataset.downloadurl = [MIME_TYPE, dlLink.download, dlLink.href].join(':');

    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
}


document.addEventListener("keydown", function(event) {
  if (event.key === "p" || event.key === "P") {
    exportCanvasAsPNG("boids", `img-${counter}-${batchID}`);
    counter ++;
  }
});

// -${batchID}-${"counter"}
