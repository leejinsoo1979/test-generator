import React, { useState, useEffect } from 'react'

const PanelList = ({ moduleState, updateModuleState, updatePanelColor, activePanelId, panelColors, setPanelColors }) => {
  // panelColors를 상태로 유지하는 대신 props로 받도록 수정
  // const [panelColors, setPanelColors] = useState({})
  
  // 모듈 구성에 따른 명칭 할당
  const assignModuleNames = () => {
    if (!moduleState.modules || moduleState.modules.length === 0) {
      return {}
    }
    
    const moduleNameMap = {}
    const lowerModule = moduleState.modules.find(m => m.type === 'lower')
    const upperModule = moduleState.modules.find(m => m.type === 'upper')
    const rightModule = moduleState.modules.find(m => m.type === 'right' || m.position === 'right')
    
    // 모듈 순서 확인
    const hasRightBeforeUpper = moduleState.modules.findIndex(m => m.type === 'right' || m.position === 'right') < 
                               moduleState.modules.findIndex(m => m.type === 'upper')
    
    // 하부장은 항상 A-1
    if (lowerModule) {
      moduleNameMap[lowerModule.id] = 'A-1'
    }
    
    // 순서에 따라 우측장과 상부장 명칭 할당
    if (hasRightBeforeUpper) {
      // 하부장>우측장>상부장 순서
      if (rightModule) moduleNameMap[rightModule.id] = 'A-2'
      if (upperModule) moduleNameMap[upperModule.id] = 'B'
    } else {
      // 하부장>상부장>우측장 순서
      if (upperModule) moduleNameMap[upperModule.id] = 'A-2'
      if (rightModule) moduleNameMap[rightModule.id] = 'B'
    }
    
    return moduleNameMap
  }
  
  // 패널 이름 생성 함수
  const getPanelName = (moduleType, panelType, moduleId, shelfIndex) => {
    // 패널 타입별 코드
    const panelCodes = {
      'top': 'TP',
      'bottom': 'BM',
      'left': 'LT',
      'right': 'RT',
      'back': 'BK',
      'shelf': 'SH'
    }
    
    // 패널 타입별 한글 이름
    const panelNames = {
      'top': '상판',
      'bottom': '하판',
      'left': '좌측판',
      'right': '우측판',
      'back': '뒷판',
      'shelf': '선반'
    }
    
    const moduleNameMap = assignModuleNames()
    const moduleName = moduleNameMap[moduleId] || moduleType
    
    // 선반인 경우 번호 추가
    if (panelType === 'shelf' && shelfIndex !== undefined) {
      return `${moduleName}_${panelCodes[panelType]}${shelfIndex + 1} ${panelNames[panelType]}`
    }
    
    // 나머지 패널은 기존 형식 유지
    return `${moduleName}_${panelCodes[panelType]} ${panelNames[panelType]}`
  }
  
  // 패널 타입의 한글 이름 반환 함수
  const getPanelTypeName = (panelType) => {
    const panelNames = {
      'top': '상판',
      'bottom': '하판',
      'left': '좌측판',
      'right': '우측판',
      'back': '뒷판',
      'shelf': '선반'
    }
    return panelNames[panelType] || panelType
  }
  
  // 패널 사이즈 계산 함수
  const calculatePanelSize = (module, panelType, shelfIndex) => {
    const { width, height, depth } = module.dimensions
    const thickness = module.panelThickness || 18
    
    // 우측장인지 확인 (좌측판 없음)
    const isRightModule = module.position === 'right'
    // 좌측판 여부 확인 (우측장은 보통 hasLeft가 false)
    const hasLeftPanel = module.panels && module.panels.hasLeft !== false
    
    // 상/하판 너비 계산 (좌우 패널 사이에 위치)
    let horizontalPanelWidth
    
    // 우측장이고 좌측 패널이 없는 경우 (하부장과 붙는 구조)
    if (isRightModule && !hasLeftPanel) {
      // 좌측 패널이 없으므로 너비에서 우측 패널 두께만 고려
      horizontalPanelWidth = width - thickness
    } else {
      // 일반적인 경우 양쪽 패널 두께 고려
      horizontalPanelWidth = width - (thickness * 2)
    }
    
    switch(panelType) {
      case 'top':
      case 'bottom':
        return `_size : (x) ${horizontalPanelWidth} x (z) ${depth} x (y) ${thickness}`
      case 'left':
      case 'right':
        return `_size : (z) ${depth} x (y) ${height} x (x) ${thickness}`
      case 'back':
        // 뒷판은 양쪽 패널 사이, 상하판 사이 위치
        const backPanelHeight = height - (thickness * 2)
        const backPanelWidth = horizontalPanelWidth
        const backPanelThickness = 9 // 뒷판은 보통 9mm 두께
        return `_size : (x) ${backPanelWidth} x (y) ${backPanelHeight} x (z) ${backPanelThickness}`
      case 'shelf':
        // 선반은 좌우 패널 사이, 깊이는 뒷판 위치 및 앞쪽 여백 고려
        const frontMargin = 20 // 앞쪽에서 20mm 들어가게 설정
        const shelfDepth = depth - thickness - frontMargin // 뒷판 두께 + 앞쪽 여백
        return `_size : (x) ${horizontalPanelWidth} x (z) ${shelfDepth} x (y) ${thickness}`
      default:
        return '_size : 정보 없음'
    }
  }
  
  // 패널 타입에 기반한 색상 생성 함수
  const generateRandomColor = (panelType) => {
    // 패널 타입별 색상 범위 설정 (hue 값)
    const hueRanges = {
      'top': [0, 30],       // 빨간색 계열 (상판)
      'bottom': [40, 70],   // 노란색/주황색 계열 (하판)
      'left': [80, 140],    // 초록색 계열 (좌측판)
      'right': [180, 240],  // 파란색 계열 (우측판)
      'back': [270, 330],   // 보라색 계열 (뒷판)
      'shelf': [150, 170]   // 청록색 계열 (선반)
    }
    
    // 패널 타입에 따른 hue 범위 가져오기
    const [minHue, maxHue] = hueRanges[panelType] || [0, 360]
    
    // 해당 범위 내에서 무작위 hue 값 생성
    const hue = minHue + Math.floor(Math.random() * (maxHue - minHue))
    const saturation = 85 + Math.floor(Math.random() * 15) // 85-100% - 더 선명한 색상
    const lightness = 50 + Math.floor(Math.random() * 15) // 50-65% - 밝은 색상으로 조정
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }
  
  // 컬러 코드를 RGB 배열로 변환
  const hexToRgb = (hex) => {
    // HSL 문자열인 경우
    if (hex.startsWith('hsl')) {
      // HSL을 실제 RGB로 변환
      const hslMatch = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(hex);
      if (hslMatch) {
        const h = parseInt(hslMatch[1]) / 360;
        const s = parseInt(hslMatch[2]) / 100;
        const l = parseInt(hslMatch[3]) / 100;
        
        let r, g, b;
        
        if (s === 0) {
          r = g = b = l; // 회색 계열
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        
        return [
          Math.round(r * 255),
          Math.round(g * 255),
          Math.round(b * 255)
        ];
      }
    }
    
    // HEX 코드일 경우
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0]
  }
  
  // 패널 토글 (보이기/숨기기) 함수
  const togglePanelVisibility = (module, panelType, shelfIndex) => {
    console.log(`패널 토글 호출: ${module.id}, ${panelType}, 선반 인덱스: ${shelfIndex}`);
    
    // 원본 모듈 찾기
    const originalModule = moduleState.modules.find(m => m.id === module.id);
    if (!originalModule) {
      console.error(`모듈 ID ${module.id}을 찾을 수 없습니다.`);
      return;
    }
    
    // 선반 토글인 경우
    if (panelType === 'shelf' && shelfIndex !== undefined) {
      // 선반 객체가 없으면 초기화
      if (!originalModule.shelves) {
        originalModule.shelves = {
          count: 0,
          distribution: 'equal',
          positions: [],
          visibility: []
        };
      }
      
      // 선반 수량 확인 및 초기화
      const shelfCount = originalModule.shelves.count || 0;
      if (shelfCount <= 0) {
        console.warn(`모듈 ${module.id}에 선반이 없습니다.`);
        return; // 선반이 없으면 처리하지 않음
      }
      
      // 선반 가시성 배열이 없거나 길이가 부족한 경우 초기화
      if (!originalModule.shelves.visibility || !Array.isArray(originalModule.shelves.visibility)) {
        // 가시성 배열 새로 생성
        originalModule.shelves.visibility = Array(shelfCount).fill(true);
      } else if (originalModule.shelves.visibility.length < shelfCount) {
        // 길이가 부족한 경우 추가
        const additionalVisibility = Array(shelfCount - originalModule.shelves.visibility.length).fill(true);
        originalModule.shelves.visibility = [...originalModule.shelves.visibility, ...additionalVisibility];
      }
      
      // 선반 가시성 배열의 깊은 복사
      const updatedVisibility = [...originalModule.shelves.visibility];
      // 현재 선반의 가시성 반전
      updatedVisibility[shelfIndex] = !updatedVisibility[shelfIndex];
      
      // 업데이트된 모듈 생성
      const updatedModule = {
        ...originalModule,
        shelves: {
          ...originalModule.shelves,
          visibility: updatedVisibility
        }
      };
      
      console.log(`선반 가시성 토글: 모듈=${module.id}, 인덱스=${shelfIndex}, 새 상태=${updatedVisibility[shelfIndex]}`);
      
      // 전체 모듈 배열 업데이트
      const updatedModules = moduleState.modules.map(m => 
        m.id === module.id ? updatedModule : m
      );
      
      // 상태 업데이트
      updateModuleState({
        ...moduleState,
        modules: updatedModules
      });
      
      // 즉시 렌더링되도록 약간의 지연 후 상태 다시 업데이트
      setTimeout(() => {
        updateModuleState(prevState => ({...prevState}));
      }, 50);
      
      return;
    }
    
    // 백패널(뒷판) 토글인 경우 특별 처리
    if (panelType === 'back') {
      // 패널 객체가 없으면 초기화
      if (!originalModule.panels) {
        originalModule.panels = {
          hasLeft: true,
          hasRight: true,
          hasTop: true,
          hasBottom: true,
          hasBack: true,
          isBackVisible: true
        };
      }
      
      // visibility 객체가 없으면 초기화
      if (!originalModule.panels.visibility) {
        originalModule.panels.visibility = {
          back: true
        };
      }
      
      // 현재 가시성 상태 확인 (두 가지 방식 모두 지원)
      let currentVisible = true;
      if (originalModule.panels.isBackVisible !== undefined) {
        currentVisible = originalModule.panels.isBackVisible;
      } else if (originalModule.panels.visibility && originalModule.panels.visibility.back !== undefined) {
        currentVisible = originalModule.panels.visibility.back;
      }
      
      // 가시성 상태 반전
      const newVisible = !currentVisible;
      
      // 두 가지 방식 모두 업데이트 (호환성 유지)
      const updatedPanels = {
        ...originalModule.panels,
        hasBack: true, // 존재 여부는 항상 true로 유지
        isBackVisible: newVisible, // 가시성 상태 업데이트
        visibility: {
          ...originalModule.panels.visibility,
          back: newVisible // 가시성 객체도 업데이트
        }
      };
      
      console.log(`백패널 가시성 토글: 모듈=${module.id}, 새 상태=${newVisible}`);
      
      // 업데이트된 모듈 생성
      const updatedModule = {
        ...originalModule,
        panels: updatedPanels
      };
      
      // 전체 모듈 배열 업데이트
      const updatedModules = moduleState.modules.map(m => 
        m.id === module.id ? updatedModule : m
      );
      
      // 상태 업데이트
      updateModuleState({
        ...moduleState,
        modules: updatedModules
      });
      
      // 즉시 렌더링되도록 약간의 지연 후 상태 다시 업데이트
      setTimeout(() => {
        updateModuleState(prevState => ({...prevState}));
      }, 50);
      
      return;
    }
    
    // 기본 패널 토글 (패널명을 필드명으로 변환)
    const panelNames = {
      'top': 'Top',
      'bottom': 'Bottom',
      'left': 'Left',
      'right': 'Right',
    };
    
    const fieldName = `has${panelNames[panelType] || panelType.charAt(0).toUpperCase() + panelType.slice(1)}`;
    
    // 패널 객체가 없으면 초기화
    if (!originalModule.panels) {
      originalModule.panels = {
        hasLeft: true,
        hasRight: true,
        hasTop: true,
        hasBottom: true,
        hasBack: true
      };
    }
    
    // 현재 상태의 반대로 설정
    const currentValue = originalModule.panels[fieldName];
    const updatedPanels = {
      ...originalModule.panels,
      [fieldName]: !currentValue
    };
    
    console.log(`패널 가시성 토글: 모듈=${module.id}, 패널=${panelType}, 필드=${fieldName}, 새 상태=${!currentValue}`);
    
    // 업데이트된 모듈 생성
    const updatedModule = {
      ...originalModule,
      panels: updatedPanels
    };
    
    // 전체 모듈 배열 업데이트
    const updatedModules = moduleState.modules.map(m => 
      m.id === module.id ? updatedModule : m
    );
    
    // 상태 업데이트
    updateModuleState({
      ...moduleState,
      modules: updatedModules
    });
    
    // 즉시 렌더링되도록 약간의 지연 후 상태 다시 업데이트
    setTimeout(() => {
      updateModuleState(prevState => ({...prevState}));
    }, 50);
  };
  
  // 모듈의 모든 패널을 평면화하는 함수
  const getAllPanels = () => {
    if (!moduleState.modules || moduleState.modules.length === 0) {
      return []
    }
    
    let allPanels = []
    
    moduleState.modules.forEach(module => {
      const { type, id, panels, shelves, position } = module
      
      // 기본 패널 추가 (보이거나 숨겨져 있더라도 모두 추가)
      if (panels) {
        // 상판 (visible 상태 포함)
        allPanels.push({
          id: `${id}_top`,
          moduleType: type,
          moduleId: id,
          panelType: 'top',
          module: module,
          visible: panels.hasTop !== false // hasTop이 false가 아니면 보이는 것으로 간주
        })
        
        // 하판
        allPanels.push({
          id: `${id}_bottom`,
          moduleType: type,
          moduleId: id,
          panelType: 'bottom',
          module: module,
          visible: panels.hasBottom !== false
        })
        
        // 좌측판 - 우측장인 경우에는 제외
        if (position !== 'right') {
          allPanels.push({
            id: `${id}_left`,
            moduleType: type,
            moduleId: id,
            panelType: 'left',
            module: module,
            visible: panels.hasLeft !== false
          })
        }
        
        // 우측판
        allPanels.push({
          id: `${id}_right`,
          moduleType: type,
          moduleId: id,
          panelType: 'right',
          module: module,
          visible: panels.hasRight !== false
        })
        
        // 뒷판
        allPanels.push({
          id: `${id}_back`,
          moduleType: type,
          moduleId: id,
          panelType: 'back',
          module: module,
          visible: panels.hasBack !== false
        })
      }
      
      // 선반 추가 (모든 선반 포함)
      if (shelves && shelves.count > 0) {
        // 선반 가시성 배열이 없는 경우 기본값으로 모두 보임 설정
        const shelfVisibility = shelves.visibility || Array(shelves.count).fill(true);
        
        for (let i = 0; i < shelves.count; i++) {
          allPanels.push({
            id: `${id}_shelf_${i}`,
            moduleType: type,
            moduleId: id,
            panelType: 'shelf',
            shelfIndex: i,
            module: module,
            visible: shelfVisibility[i] !== false // visibility 배열의 해당 인덱스 값 사용
          })
        }
      }
    })
    
    return allPanels
  }
  
  // 패널 선택 시 색상 업데이트
  const handlePanelSelect = (panelId) => {
    // 이미 색상이 할당되어 있는지 확인
    const color = panelColors[panelId]
    
    if (color && updatePanelColor) {
      // Three.js에 사용할 색상 정보로 변환 (0-1 범위)
      const rgbColor = hexToRgb(color)
      const normalizedColor = rgbColor.map(c => c / 255)
      
      // 패널 색상 업데이트 함수 호출 (선택된 패널 ID와 색상 정보 전달)
      updatePanelColor(panelId, normalizedColor)
    }
  }
  
  // 컴포넌트 마운트 시 임의의 색상 할당
  useEffect(() => {
    // 이미 panelColors에 값이 있다면 새로 생성하지 않음
    if (Object.keys(panelColors).length > 0) {
      const panels = getAllPanels();
      const newColors = {...panelColors};
      let hasNewPanels = false;
      
      // 새로운 패널에 대해서만 색상 생성
      panels.forEach(panel => {
        if (!newColors[panel.id]) {
          newColors[panel.id] = generateRandomColor(panel.panelType);
          hasNewPanels = true;
        }
      });
      
      // 새 패널이 있을 경우에만 상태 업데이트
      if (hasNewPanels) {
        setPanelColors(newColors);
      }
      
      return;
    }
    
    const panels = getAllPanels()
    const colors = {}
    
    panels.forEach(panel => {
      colors[panel.id] = generateRandomColor(panel.panelType)
    })
    
    setPanelColors(colors)
  }, [moduleState, panelColors, setPanelColors])
  
  // 패널 목록 가져오기
  const panels = getAllPanels()
  
  // 패널 정렬 함수 (타입별로 그룹화하고 선반은 번호순으로 정렬)
  const sortedPanels = [...panels].sort((a, b) => {
    // 패널 타입 우선순위
    const typeOrder = { 'top': 1, 'bottom': 2, 'left': 3, 'right': 4, 'back': 5, 'shelf': 6 };
    
    // 다른 타입이면 타입 우선순위로 정렬
    if (a.panelType !== b.panelType) {
      return typeOrder[a.panelType] - typeOrder[b.panelType];
    }
    
    // 같은 타입이면, 선반인 경우 선반 번호로 정렬
    if (a.panelType === 'shelf') {
      return a.shelfIndex - b.shelfIndex;
    }
    
    // 나머지는 기본 순서 유지
    return 0;
  });
  
  // 패널을 타입별로 그룹화
  const groupedPanels = sortedPanels.reduce((groups, panel) => {
    const { panelType } = panel;
    if (!groups[panelType]) {
      groups[panelType] = [];
    }
    groups[panelType].push(panel);
    return groups;
  }, {});
  
  // 패널 타입별 한글 이름 (그룹 헤더용)
  const panelTypeHeaders = {
    'top': '상판',
    'bottom': '하판',
    'left': '좌측판',
    'right': '우측판',
    'back': '뒷판',
    'shelf': '선반'
  };
  
  // 패널 타입 순서 정의
  const panelTypeOrder = ['top', 'bottom', 'left', 'right', 'back', 'shelf'];
  
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold border-b pb-2">패널 리스트</h2>
        <button 
          className="bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 transition text-sm flex items-center"
          onClick={() => {
            // ExportPanel 컴포넌트의 PDF 내보내기 함수를 직접 호출할 수 없으므로
            // PDF 내보내기 버튼 클릭 이벤트를 시뮬레이션
            const exportPdfButtons = document.querySelectorAll('button');
            let pdfButton = null;
            
            // 내용에 "PDF 내보내기"가 포함된 버튼 찾기
            for (const button of exportPdfButtons) {
              if (button.textContent.includes('PDF 내보내기')) {
                pdfButton = button;
                break;
              }
            }
            
            if (pdfButton) {
              pdfButton.click();
            } else {
              alert('PDF 내보내기 버튼을 찾을 수 없습니다.');
            }
          }}
          title="PDF로 내보내기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
          </svg>
          PDF
        </button>
      </div>
      <div className="bg-gray-100 rounded p-4 w-full">
        {Object.keys(groupedPanels).length > 0 ? (
          <div className="space-y-4">
            {panelTypeOrder.map(panelType => {
              const typePanels = groupedPanels[panelType];
              if (!typePanels || typePanels.length === 0) return null;
              
              return (
                <div key={panelType} className="border-b pb-3 last:border-b-0">
                  <h3 className="text-md font-semibold mb-2 text-gray-700 bg-gray-200 px-3 py-1 rounded-t">
                    {panelTypeHeaders[panelType]} ({typePanels.length})
                  </h3>
                  <ul className="space-y-2">
                    {typePanels.map((panel) => (
                      <li 
                        key={panel.id} 
                        className={`py-2 px-3 rounded shadow-sm hover:shadow transition flex items-center ${
                          panel.id === activePanelId 
                            ? 'bg-blue-50 border-l-4 border-blue-500' 
                            : panel.visible ? 'bg-white border-l-4' : 'bg-gray-200 border-l-4'
                        }`}
                        style={{
                          borderLeftColor: panel.id === activePanelId ? '#3b82f6' : panelColors[panel.id] || generateRandomColor(panel.panelType),
                        }}
                      >
                        {/* 색상 원 및 패널 정보 */}
                        <div 
                          className={`w-5 h-5 rounded-full mr-2 flex-shrink-0 cursor-pointer ${
                            panel.id === activePanelId ? 'ring-2 ring-blue-500' : ''
                          }`}
                          style={{ 
                            backgroundColor: panelColors[panel.id] || generateRandomColor(panel.panelType),
                            opacity: panel.visible ? 1 : 0.5
                          }}
                          onClick={() => handlePanelSelect(panel.id)}
                          title="컬러 선택"
                        ></div>
                        
                        {/* 패널 정보 */}
                        <div className="flex-1 min-w-0">
                          <div 
                            className={`text-sm ${!panel.visible ? 'text-gray-500' : 'text-gray-800'} overflow-hidden text-ellipsis`}
                            title={`${getPanelTypeName(panel.panelType)} - ${panel.moduleType === 'lower' ? '하부장' : panel.moduleType === 'upper' ? '상부장' : '우측장'}`}
                          >
                            {getPanelName(panel.moduleType, panel.panelType, panel.moduleId, panel.shelfIndex)}
                            {calculatePanelSize(panel.module, panel.panelType, panel.shelfIndex)}
                          </div>
                        </div>
                        
                        {/* 토글 버튼 */}
                        <button
                          className={`ml-2 p-1 rounded-md ${
                            panel.visible 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          onClick={() => togglePanelVisibility(panel.module, panel.panelType, panel.shelfIndex)}
                          title={panel.visible ? '패널 숨기기' : '패널 표시하기'}
                        >
                          {panel.visible ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">패널이 없습니다</div>
        )}
      </div>
    </div>
  )
}

export default PanelList