import React from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { exportModuleToGLB } from '../utils/three/glbExporter'

// 한글-영문 전환 매핑
const koreanToEnglish = {
  '가구 디자인 명세서': 'Furniture Design Specification',
  '작성일': 'Date',
  '가구 정보': 'Furniture Information',
  '전체 크기': 'Total Size',
  '가로': 'Width',
  '세로': 'Height',
  '깊이': 'Depth',
  '패널 리스트': 'Panel List',
  '패널 유형': 'Panel Type',
  '치수': 'Dimensions',
  '수량': 'Quantity',
  '상판': 'Top Panel',
  '하판': 'Bottom Panel',
  '좌측판': 'Left Panel',
  '우측판': 'Right Panel',
  '뒷판': 'Back Panel',
  '선반': 'Shelf',
  '가구디자인': 'Furniture'
}

const ExportPanel = ({ moduleState }) => {
  // JSON 내보내기
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(moduleState, null, 2))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', dataStr)
    downloadAnchorNode.setAttribute('download', `${moduleState.name || 'module'}.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  // PDF 내보내기 함수
  const handleExportPDF = async () => {
    try {
      // 로딩 표시
      const loadingElement = document.createElement('div')
      loadingElement.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'
      loadingElement.innerHTML = `
        <div class="bg-white p-4 rounded-lg shadow-lg">
          <p class="text-lg font-semibold">PDF 생성 중...</p>
          <div class="w-full h-2 bg-gray-200 rounded-full mt-2">
            <div class="h-full bg-blue-500 rounded-full animate-pulse" style="width: 100%"></div>
          </div>
        </div>
      `
      document.body.appendChild(loadingElement)

      // 뷰어 컨테이너 찾기
      const viewerContainer = document.getElementById('furniture-viewer')
      if (!viewerContainer) {
        throw new Error('가구 뷰어를 찾을 수 없습니다')
      }

      console.log('캡처할 뷰어:', viewerContainer)
      
      // 캡처 전에 버튼들을 일시적으로 숨김
      const buttons = document.querySelectorAll('.absolute button, .absolute label')
      buttons.forEach(btn => {
        btn.style.opacity = '0'
        btn.style.visibility = 'hidden'
      })
      
      // 잠시 대기하여 변경사항이 적용되도록 함
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // 캡처 시도
      let canvasImage = null
      
      try {
        // 첫 번째 방법: html2canvas 사용
        console.log('html2canvas로 캡처 시도 중...')
        const canvas = await html2canvas(viewerContainer, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scale: 2,
          logging: true,
          width: viewerContainer.offsetWidth,
          height: viewerContainer.offsetHeight,
          onclone: (clonedDoc) => {
            // 클론된 문서의 뷰어에서 버튼 숨기기
            const clonedViewer = clonedDoc.getElementById('furniture-viewer')
            if (clonedViewer) {
              const clonedButtons = clonedViewer.querySelectorAll('button')
              clonedButtons.forEach(btn => {
                btn.style.display = 'none'
              })
            }
          }
        })
        
        // 캡처된 이미지를 데이터 URL로 변환
        canvasImage = canvas.toDataURL('image/png', 1.0)
        console.log('html2canvas 캡처 성공')
      } catch (e1) {
        console.error('html2canvas 캡처 실패:', e1)
        
        // 대체 방법: domtoimage를 임시 구현하여 시도
        try {
          console.log('직접 캔버스에서 이미지 추출 시도...')
          const threeCanvas = viewerContainer.querySelector('canvas')
          if (threeCanvas) {
            canvasImage = threeCanvas.toDataURL('image/png', 1.0)
            console.log('캔버스 직접 추출 성공')
          } else {
            throw new Error('캔버스 요소를 찾을 수 없습니다')
          }
        } catch (e2) {
          console.error('대체 캡처 방법도 실패:', e2)
          canvasImage = null
        }
      } finally {
        // 버튼들을 다시 표시
        buttons.forEach(btn => {
          btn.style.opacity = '1'
          btn.style.visibility = 'visible'
        })
      }
      
      // PDF 생성
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      
      // PDF 헤더 
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text('Furniture Design Specification', margin, margin + 10)
      
      // 날짜
      const today = new Date()
      const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
      pdf.setFontSize(10)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Date: ${dateStr}`, pageWidth - margin - 40, margin + 10)
      
      // 이미지 추가
      if (canvasImage) {
        try {
          console.log('이미지를 PDF에 추가합니다')
          
          // 이미지 크기 계산 - 이미지 비율 유지
          const imgWidth = pageWidth - (margin * 2)
          const imgHeight = 100 // 고정 높이
          
          // 이미지를 PDF에 추가
          pdf.addImage(
            canvasImage, 
            'PNG', 
            margin, 
            margin + 15, 
            imgWidth, 
            imgHeight
          )
          
          console.log('이미지 추가 완료')
        } catch (imgErr) {
          console.error('이미지 PDF 추가 오류:', imgErr)
          
          // 오류 발생 시 간단한 대체 텍스트 추가
          pdf.setTextColor(200, 0, 0)
          pdf.text('이미지를 표시할 수 없습니다', pageWidth / 2, margin + 50, { align: 'center' })
        }
      } else {
        pdf.setTextColor(200, 0, 0)
        pdf.text('이미지를 표시할 수 없습니다', pageWidth / 2, margin + 50, { align: 'center' })
      }
      
      // 모듈 정보 및 패널 데이터 수집
      let yPosition = margin + 120 // 이미지 아래 위치
      
      // 가구 정보 섹션
      pdf.setFontSize(14)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Furniture Information', margin, yPosition)
      yPosition += 10
      
      // 모듈 타입별 계산
      const lowerModules = moduleState.modules?.filter(m => m.type === 'lower' && m.position !== 'right') || []
      const upperModules = moduleState.modules?.filter(m => m.type === 'upper' || m.position === 'top') || []
      const rightModules = moduleState.modules?.filter(m => m.position === 'right') || []
      
      // 전체 크기 계산
      let totalWidth = 0
      let totalHeight = 0
      let totalDepth = 0
      
      if (moduleState.modules && moduleState.modules.length > 0) {
        if (lowerModules.length > 0 && upperModules.length > 0) {
          totalWidth = Math.max(
            ...lowerModules.map(m => m.dimensions.width),
            ...upperModules.map(m => m.dimensions.width)
          )
          
          totalHeight = lowerModules[0].dimensions.height + 
                      upperModules.reduce((sum, m) => Math.max(sum, m.dimensions.height), 0)
          
          totalDepth = Math.max(
            ...lowerModules.map(m => m.dimensions.depth),
            ...upperModules.map(m => m.dimensions.depth)
          )
        } else if (lowerModules.length > 0 && rightModules.length > 0) {
          totalWidth = lowerModules.reduce((sum, m) => sum + m.dimensions.width, 0) +
                      rightModules.reduce((sum, m) => sum + m.dimensions.width, 0)
          
          totalHeight = Math.max(
            lowerModules[0].dimensions.height,
            rightModules[0].dimensions.height
          )
          
          totalDepth = Math.max(
            ...lowerModules.map(m => m.dimensions.depth),
            ...rightModules.map(m => m.dimensions.depth)
          )
        } else if (moduleState.modules.length > 0) {
          const firstModule = moduleState.modules[0]
          totalWidth = firstModule.dimensions.width
          totalHeight = firstModule.dimensions.height
          totalDepth = firstModule.dimensions.depth
        }
      }
      
      // 크기 정보 표시
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Total Size: Width ${totalWidth}mm x Height ${totalHeight}mm x Depth ${totalDepth}mm`, margin, yPosition)
      yPosition += 15
      
      // 패널 정보 테이블 생성
      const panelInfo = []
      
      // 모든 모듈의 패널 정보 수집
      moduleState.modules?.forEach(module => {
        const { dimensions, panelThickness = 18, panels, shelves } = module
        const thickness = panelThickness
        const isRightModule = module.position === 'right'
        const hasLeftPanel = !isRightModule || (module.panels && module.panels.hasLeft !== false)
        
        // 상/하판 너비 계산
        const horizontalPanelWidth = isRightModule && !hasLeftPanel 
          ? dimensions.width - thickness 
          : dimensions.width - (thickness * 2)
        
        // 패널 정보 추가
        if (panels) {
          if (panels.hasTop !== false) {
            addPanelInfo(panelInfo, 'Top Panel', `${horizontalPanelWidth} x ${dimensions.depth} x ${thickness}`)
          }
          
          if (panels.hasBottom !== false) {
            addPanelInfo(panelInfo, 'Bottom Panel', `${horizontalPanelWidth} x ${dimensions.depth} x ${thickness}`)
          }
          
          if (panels.hasLeft !== false && !isRightModule) {
            addPanelInfo(panelInfo, 'Left Panel', `${dimensions.depth} x ${dimensions.height} x ${thickness}`)
          }
          
          if (panels.hasRight !== false) {
            addPanelInfo(panelInfo, 'Right Panel', `${dimensions.depth} x ${dimensions.height} x ${thickness}`)
          }
          
          if (panels.hasBack !== false) {
            const backPanelHeight = dimensions.height - (thickness * 2)
            const backPanelWidth = horizontalPanelWidth
            const backPanelThickness = 9
            addPanelInfo(panelInfo, 'Back Panel', `${backPanelWidth} x ${backPanelHeight} x ${backPanelThickness}`)
          }
        }
        
        // 선반 추가
        if (shelves && shelves.count > 0) {
          const shelfDepth = dimensions.depth - thickness - 20
          addPanelInfo(panelInfo, 'Shelf', `${horizontalPanelWidth} x ${shelfDepth} x ${thickness}`, shelves.count)
        }
      })
      
      // 패널 테이블 헤더
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Panel List', margin, yPosition)
      yPosition += 10
      
      // 테이블 헤더
      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, yPosition, pageWidth - margin * 2, 10, 'F')
      
      const colWidth = (pageWidth - margin * 2) / 3
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Panel Type', margin + 5, yPosition + 7)
      pdf.text('Dimensions (mm)', margin + colWidth + 5, yPosition + 7)
      pdf.text('Quantity', margin + colWidth * 2 + 5, yPosition + 7)
      
      yPosition += 15
      pdf.setFont('helvetica', 'normal')
      
      // 테이블 내용
      const tableData = panelInfo.map(panel => [panel.type, panel.dimensions, panel.count.toString()])
      tableData.forEach((row, index) => {
        pdf.text(row[0], margin + 5, yPosition)
        pdf.text(row[1], margin + colWidth + 5, yPosition)
        pdf.text(row[2], margin + colWidth * 2 + 5, yPosition)
        
        // 구분선
        if (index < tableData.length - 1) {
          pdf.setDrawColor(220, 220, 220)
          pdf.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5)
        }
        
        yPosition += 10
      })
      
      // 푸터
      pdf.setFontSize(8)
      pdf.setTextColor(150, 150, 150)
      pdf.text('© Furniture Design', pageWidth / 2, pageHeight - 5, { align: 'center' })
      
      // PDF 저장
      console.log('PDF 저장 중...')
      pdf.save(`Furniture_${dateStr}.pdf`)
      console.log('PDF 저장 완료')
      
      // 로딩 제거
      document.body.removeChild(loadingElement)
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('PDF 생성 실패: ' + error.message)
      
      // 로딩 요소가 있으면 제거
      const loadingElement = document.querySelector('.fixed.inset-0.flex.items-center.justify-center')
      if (loadingElement) {
        document.body.removeChild(loadingElement)
      }
    }
  }
  
  // 패널 정보 추가 헬퍼 함수
  const addPanelInfo = (panelInfo, type, dimensions, count = 1) => {
    // 이미 있는 패널인지 확인
    const existingPanel = panelInfo.find(p => p.type === type && p.dimensions === dimensions)
    
    if (existingPanel) {
      existingPanel.count += count
    } else {
      panelInfo.push({ type, dimensions, count })
    }
  }

  // GLB 내보내기 함수
  const handleExportGLB = async () => {
    try {
      // 로딩 표시
      const loadingElement = document.createElement('div')
      loadingElement.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'
      loadingElement.innerHTML = `
        <div class="bg-white p-4 rounded-lg shadow-lg">
          <p class="text-lg font-semibold">GLB 생성 중...</p>
          <div class="w-full h-2 bg-gray-200 rounded-full mt-2">
            <div class="h-full bg-blue-500 rounded-full animate-pulse" style="width: 100%"></div>
          </div>
        </div>
      `
      document.body.appendChild(loadingElement)

      // 뷰어 컨테이너에서 Three.js 씬 가져오기
      const viewerContainer = document.getElementById('furniture-viewer')
      if (!viewerContainer) {
        throw new Error('가구 뷰어를 찾을 수 없습니다')
      }

      // 함수 호출하여 GLB 변환 실행
      await exportModuleToGLB(moduleState)
      
      // 로딩 제거
      document.body.removeChild(loadingElement)
    } catch (error) {
      console.error('GLB 생성 오류:', error)
      alert('GLB 생성 실패: ' + error.message)
      
      // 로딩 요소가 있으면 제거
      const loadingElement = document.querySelector('.fixed.inset-0.flex.items-center.justify-center')
      if (loadingElement) {
        document.body.removeChild(loadingElement)
      }
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 border-b pb-2">내보내기</h2>
      <div className="flex flex-wrap gap-4">
        <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition" onClick={handleExportJSON}>
          JSON 내보내기
        </button>
        <button 
          className="bg-green-600 text-white rounded px-4 py-2 hover:bg-green-700 transition flex items-center"
          onClick={handleExportPDF}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
          </svg>
          PDF 내보내기
        </button>
        <button 
          className="bg-purple-600 text-white rounded px-4 py-2 hover:bg-purple-700 transition flex items-center"
          onClick={handleExportGLB}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          GLB 내보내기
        </button>
      </div>
    </div>
  )
}

export default ExportPanel
