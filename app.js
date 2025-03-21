import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;

const createHandLandmarker = async () => {
  console.log("Loading HandLandmarker...");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "CPU" // Use "CPU" for fallback
    },
    runningMode: "VIDEO",
    numHands: 2
  });
  console.log("HandLandmarker loaded successfully!"); // Log when it is fully loaded.
  demosSection.classList.remove("invisible");
};
createHandLandmarker();

// Demo 1: Image Detection on Click
const imageContainers = document.getElementsByClassName("detectOnClick");

for (let i = 0; i < imageContainers.length; i++) {
  imageContainers[i].children[0].addEventListener("click", handleClick);
}

async function handleClick(event) {
  if (!handLandmarker) {
    console.log("Wait for handLandmarker to load before clicking!");
    return;
  }

  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await handLandmarker.setOptions({ runningMode: "IMAGE" });
  }

  const allCanvas = event.target.parentNode.getElementsByClassName("canvas");
  for (let i = allCanvas.length - 1; i >= 0; i--) {
    allCanvas[i].parentNode.removeChild(allCanvas[i]);
  }

  const handLandmarkerResult = handLandmarker.detect(event.target);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("class", "canvas");
  canvas.setAttribute("width", event.target.naturalWidth + "px");
  canvas.setAttribute("height", event.target.naturalHeight + "px");
  canvas.style = "left: 0px; top: 0px; width: " + event.target.width + "px; height: " + event.target.height + "px;";
  event.target.parentNode.appendChild(canvas);
  const cxt = canvas.getContext("2d");

  // Draw hand landmarks and connectors
  for (const landmarks of handLandmarkerResult.landmarks) {
    drawConnectors(cxt, landmarks, HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 5
    });
    drawLandmarks(cxt, landmarks, { color: "#FF0000", lineWidth: 1 });

    // Ring try-on for the ring finger
    addRingToRingFinger(landmarks, cxt, event.target.width, event.target.height);
  }
}

// Add ring image to the ring finger
function addRingToRingFinger(landmarks, context, imgWidth, imgHeight) {
  const ringFingerBase = landmarks[12]; // Ring finger base
  const ringFingerMiddle = landmarks[13]; // Ring finger middle
  const ringFingerTip = landmarks[14]; // Ring finger tip

  // Get the distance between the base and tip to scale the ring
  const ringFingerLength = Math.sqrt(
    Math.pow(ringFingerTip.x - ringFingerBase.x, 2) +
    Math.pow(ringFingerTip.y - ringFingerBase.y, 2)
  );

  const ringImage = new Image();
  ringImage.src = 'assets/ring.png'; // Path to your ring image
  
  ringImage.onload = () => {
    // Calculate the scale factor based on the finger length
    const scale = ringFingerLength * imgWidth / 150;

    // Position of the ring based on the middle of the finger
    const ringX = (ringFingerBase.x + ringFingerMiddle.x + ringFingerTip.x) / 3 * imgWidth;
    const ringY = (ringFingerBase.y + ringFingerMiddle.y + ringFingerTip.y) / 3 * imgHeight;

    // Draw the ring on the canvas, adjusted for scale and position
    context.drawImage(ringImage, ringX - scale / 2, ringY - scale / 2, scale, scale);
  };
}

// Demo 2: Webcam Detection
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

function enableCam(event) {
  if (!handLandmarker) {
    console.log("Wait! HandLandmarker not loaded yet.");
    return;
  }

  webcamRunning = !webcamRunning;
  enableWebcamButton.innerText = webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS";

  const constraints = {
    video: true
  };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results;

async function predictWebcam() {
  canvasElement.style.width = video.videoWidth + "px";
  canvasElement.style.height = video.videoHeight + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });

      // Ring try-on for the ring finger
      addRingToRingFinger(landmarks, canvasCtx, video.videoWidth, video.videoHeight);
    }
  }
  canvasCtx.restore();

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}