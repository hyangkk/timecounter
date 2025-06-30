import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function formatTime(sec: number) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

interface RecordItem {
  id: number
  start: number
  end: number
  duration: number
}

function getUserIdFromUrlOrLocal() {
  const params = new URLSearchParams(window.location.search);
  const urlUser = params.get('user');
  if (urlUser) {
    localStorage.setItem('user_id', urlUser);
    return urlUser;
  }
  let id = localStorage.getItem('user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('user_id', id);
  }
  return id;
}

function App() {
  const userId = getUserIdFromUrlOrLocal();
  const [records, setRecords] = useState<RecordItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerId, setTimerId] = useState<number | null>(null)
  const [manualSec, setManualSec] = useState('')
  const [manualDate, setManualDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [adding, setAdding] = useState(false)
  const [openDetail, setOpenDetail] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)

  // 날짜별로 기록 그룹핑 (KST 기준)
  const recordsByDate: { [date: string]: RecordItem[] } = {}
  records.forEach(r => {
    const d = new Date(r.start)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    if (!recordsByDate[dateStr]) recordsByDate[dateStr] = []
    recordsByDate[dateStr].push(r)
  })
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  const todayTotal = recordsByDate[todayStr]?.reduce((acc, cur) => acc + cur.duration, 0) || 0
  const sortedDates = Object.keys(recordsByDate).sort((a, b) => b.localeCompare(a))

  // Supabase에서 기록 불러오기
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
        .order('start', { ascending: false })
      if (data) setRecords(data)
    })()
  }, [userId])

  // 스톱워치 시작
  const handleStart = () => {
    setIsRunning(true)
    const now = Date.now()
    setStartTime(now)
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - now) / 1000))
    }, 1000)
    setTimerId(id)
  }

  // 스톱워치 종료
  const handleStop = async () => {
    setIsRunning(false)
    if (timerId) clearInterval(timerId)
    if (startTime) {
      const end = Date.now()
      const duration = Math.floor((end - startTime) / 1000)
      const { data } = await supabase.from('records').insert([
        { user_id: userId, start: startTime, end, duration }
      ]).select()
      if (data) setRecords([data[0], ...records])
      setElapsed(0)
      setStartTime(null)
    }
  }

  // 기록 삭제
  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('records').delete().eq('id', id)
    setRecords(records.filter(r => r.id !== id))
  }

  // 기록 수정
  const handleEdit = async (id: number) => {
    const newSec = prompt('수정할 시간을 초 단위로 입력하세요:')
    if (!newSec) return
    const sec = parseInt(newSec)
    if (isNaN(sec) || sec < 0) return alert('올바른 숫자를 입력하세요.')
    await supabase.from('records').update({ duration: sec }).eq('id', id)
    setRecords(records.map(r => r.id === id ? { ...r, duration: sec } : r))
  }

  // KST 기준 날짜를 ms로 변환 (타임존 버그 완전 방지)
  function getKstMs(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0).getTime()
  }

  // 수동 기록 추가
  const handleAddManual = async () => {
    const sec = parseInt(manualSec)
    if (isNaN(sec) || sec <= 0) {
      alert('양의 정수를 입력하세요.')
      return
    }
    setAdding(true)
    const ms = getKstMs(manualDate)
    const { data } = await supabase.from('records').insert([
      { user_id: userId, start: ms, end: ms, duration: sec }
    ]).select()
    if (data) setRecords([data[0], ...records])
    setManualSec('')
    setAdding(false)
  }

  // 내 기록 공유 링크
  const shareUrl = `${window.location.origin}${window.location.pathname}?user=${userId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    alert('공유 링크가 복사되었습니다!')
  }

  return (
    <div className="container" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      {/* 오늘/지금 관련 정보 맨 위 */}
      <div style={{ margin: '0 0 32px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>오늘 누적 시간</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: '#222', marginBottom: 24 }}>{formatTime(todayTotal)}</div>
        <div className="stopwatch-circle" style={{ margin: '0 auto 16px auto', width: 180, height: 180, background: '#222', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="stopwatch-time" style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 18 }}>{formatTime(isRunning ? elapsed : 0)}</div>
          <button
            className="stopwatch-btn"
            onClick={isRunning ? handleStop : handleStart}
            style={{
              fontSize: 24,
              fontWeight: 700,
              padding: '16px 32px',
              width: 'auto',
              borderRadius: 24,
              marginTop: 0,
              marginBottom: 0,
              background: isRunning ? '#ff4d4f' : '#fff',
              color: isRunning ? 'white' : '#646cff',
              border: isRunning ? 'none' : '2px solid #646cff',
              boxShadow: '0 2px 8px #0002',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            {isRunning ? '종료' : '시작'}
          </button>
        </div>
        <button 
          onClick={handleCopy}
          style={{
            fontSize: 16,
            fontWeight: 600,
            padding: '10px 24px',
            background: '#eaeaea',
            color: '#333',
            border: 'none',
            borderRadius: 8,
            boxShadow: '0 2px 8px #0001',
            cursor: 'pointer',
            marginTop: 18
          }}
        >
          📋 내 기록 공유 링크 복사
        </button>
      </div>
      {/* 오늘의 기록 펼쳐서 모두 보여주기 */}
      <div style={{ margin: '32px 0 16px 0', fontWeight: 700, fontSize: 20 }}>오늘의 기록</div>
      {recordsByDate[todayStr] && recordsByDate[todayStr].length > 0 ? (
        <ul>
          {recordsByDate[todayStr].map((rec) => (
            <li key={rec.id}>
              {formatTime(rec.duration)}
              {rec.start !== rec.end && (
                <> (시작: {new Date(rec.start).toLocaleTimeString()} ~ 종료: {new Date(rec.end).toLocaleTimeString()})</>
              )}
              <button onClick={() => handleEdit(rec.id)} style={{marginLeft:8}}>수정</button>
              <button onClick={() => handleDelete(rec.id)} style={{marginLeft:4}}>삭제</button>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{color:'#aaa', textAlign:'center'}}>오늘 기록 없음</div>
      )}
      {/* 과거 날짜별 누적 시간 표 + 자세히 보기 */}
      <div style={{ margin: '32px 0 16px 0', fontWeight: 700, fontSize: 20 }}>과거 기록</div>
      <table style={{ width: '100%', maxWidth: 400, margin: '0 auto 24px auto', borderCollapse: 'collapse', background: '#fafbfc' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>날짜</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}>누적 시간</th>
            <th style={{ padding: 8, border: '1px solid #ddd' }}></th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.filter(dateStr => dateStr !== todayStr).map(dateStr => {
            const total = recordsByDate[dateStr].reduce((acc, cur) => acc + cur.duration, 0)
            return (
              <>
                <tr key={dateStr}>
                  <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>{dateStr}</td>
                  <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>{formatTime(total)}</td>
                  <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                    <button onClick={() => setOpenDetail(openDetail === dateStr ? null : dateStr)} style={{fontSize:15, fontWeight:600, padding:'6px 16px', borderRadius:6, border:'1px solid #aaa', background:'#fff', cursor:'pointer'}}>
                      {openDetail === dateStr ? '닫기' : '자세히 보기'}
                    </button>
                  </td>
                </tr>
                {openDetail === dateStr && (
                  <tr>
                    <td colSpan={3} style={{ background:'#f9f9f9', padding:12 }}>
                      <ul style={{margin:0}}>
                        {recordsByDate[dateStr].map((rec) => (
                          <li key={rec.id}>
                            {formatTime(rec.duration)}
                            {rec.start !== rec.end && (
                              <> (시작: {new Date(rec.start).toLocaleTimeString()} ~ 종료: {new Date(rec.end).toLocaleTimeString()})</>
                            )}
                            <button onClick={() => handleEdit(rec.id)} style={{marginLeft:8}}>수정</button>
                            <button onClick={() => handleDelete(rec.id)} style={{marginLeft:4}}>삭제</button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
      {/* 수동 기록 입력 UI - 맨 아래 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '32px 0 0 0' }}>
        <button
          onClick={() => setShowManualInput(v => !v)}
          style={{ fontSize: 15, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: '#f5f5f5', color: '#333', border: '1px solid #bbb', cursor: 'pointer', marginRight: 8 }}
        >
          수동 기록 추가
        </button>
        {showManualInput && (
          <>
            <input
              type="number"
              min={1}
              placeholder="초 단위로 입력"
              value={manualSec}
              onChange={e => setManualSec(e.target.value)}
              style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', marginRight: 8, width: 100 }}
            />
            <input
              type="date"
              value={manualDate}
              onChange={e => setManualDate(e.target.value)}
              style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', marginRight: 8 }}
            />
            <button
              onClick={handleAddManual}
              disabled={adding}
              style={{ fontSize: 15, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              입력
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default App
