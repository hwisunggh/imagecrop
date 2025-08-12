import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import 'react-image-crop/dist/ReactCrop.css';
import './App.css';

// Icons as SVG components
const UploadIcon = () => (
  <svg className="drop-zone-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
  </svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
        <path d="M0 0h24v24H0V0z" fill="none"/>
        <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8z"/>
    </svg>
);

function App() {
  const [sourceImages, setSourceImages] = useState([]);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [isCropping, setIsCropping] = useState(false);

  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  const resetAll = () => {
    setSourceImages([]);
    setCroppedImages([]);
    setCrop(undefined);
    setCompletedCrop(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleFiles = (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const filesArray = acceptedFiles.map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      setSourceImages(filesArray);
      setCroppedImages([]);
      setCompletedCrop(null);

      const image = new Image();
      image.src = filesArray[0].url;
      image.onload = () => {
        const { naturalWidth, naturalHeight } = image;
        const defaultCrop = centerCrop(
          makeAspectCrop({ unit: '%', width: 50 }, undefined, naturalWidth, naturalHeight),
          naturalWidth,
          naturalHeight
        );
        setCrop(defaultCrop);
      };
    }
  };

  const onDrop = useCallback(acceptedFiles => {
    handleFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: 'image/*',
    noClick: true,
    noKeyboard: true
  });

  // Manually trigger file input click
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCropAllImages = async () => {
    if (!completedCrop || !imgRef.current || !sourceImages.length) {
      alert('먼저 이미지와 자르기 영역을 선택해주세요.');
      return;
    }

    setIsCropping(true);
    setCroppedImages([]);

    const imageElement = imgRef.current;
    const scaleX = imageElement.naturalWidth / imageElement.width;
    const scaleY = imageElement.naturalHeight / imageElement.height;
    const pixelCrop = {
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    };

    try {
      const promises = sourceImages.map(source => {
        const img = new Image();
        img.src = source.url;
        img.crossOrigin = 'anonymous';
        return new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('2D context를 가져오는데 실패했습니다.'));
            ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
            canvas.toBlob(blob => {
              if (blob) resolve({ name: source.file.name, blob, url: URL.createObjectURL(blob) });
              else reject(new Error('Canvas에서 blob을 생성하는데 실패했습니다.'));
            }, 'image/png');
          };
          img.onerror = (err) => reject(err);
        });
      });
      const cropped = await Promise.all(promises);
      setCroppedImages(cropped);
    } catch (error) {
      console.error("이미지 자르기 오류:", error);
      alert(`이미지를 자르는 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsCropping(false);
    }
  };

  const handleDownloadAll = async () => {
    if (croppedImages.length === 0) {
      alert('다운로드할 잘라낸 이미지가 없습니다.');
      return;
    }
    const zip = new JSZip();
    croppedImages.forEach((img) => {
      const nameWithoutExt = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
      const newName = `cropped_${nameWithoutExt}.png`;
      zip.file(newName, img.blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'cropped-images.zip');
  };

  return (
    <div className="App">
      <header className="header">
        <h1>배치 이미지 크롭 도구</h1>
        <p>여러 이미지에서 동일한 영역을 한번에 잘라보세요</p>
      </header>

      {sourceImages.length === 0 ? (
        <div className="card">
            <div className="card-header">
                <h2>1. 이미지 업로드</h2>
            </div>
            <div {...getRootProps({ className: 'drop-zone' })}>
                <input {...getInputProps({ ref: fileInputRef })} />
                <UploadIcon />
                <p>{isDragActive ? '여기에 파일을 놓으세요...' : '여러 이미지 파일을 선택하거나 드래그하세요'}</p>
                <button type="button" className="button" onClick={handleButtonClick}>파일 선택</button>
            </div>
        </div>
      ) : (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>2. 자를 영역 선택</h2>
                    <button onClick={resetAll} className="reset-button"><ResetIcon/> 초기화</button>
                </div>
                <div className="crop-container">
                    <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
                        <img ref={imgRef} src={sourceImages[0].url} alt="Source for cropping" />
                    </ReactCrop>
                </div>
            </div>
            
            <button onClick={handleCropAllImages} disabled={!completedCrop || isCropping} className="button">
                {isCropping ? '자르는 중...' : `모든 이미지 (${sourceImages.length}개) 자르기`}
            </button>

            {croppedImages.length > 0 && (
                <div className="card results-container">
                    <div className="card-header">
                        <h2>3. 결과 확인 및 다운로드</h2>
                    </div>
                    <div className="results-grid">
                        {croppedImages.map((image, index) => (
                        <div key={index} className="result-item">
                            <img src={image.url} alt={`Cropped ${index + 1}`} />
                        </div>
                        ))}
                    </div>
                    <button onClick={handleDownloadAll} className="button" style={{marginTop: '20px'}}>
                        전체 다운로드
                    </button>
                </div>
            )}
        </>
      )}
    </div>
  );
}

export default App;