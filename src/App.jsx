import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

export default function App() {
  const [projects, setProjects] = useState([])
  const [session, setSession] = useState(null)
  
  // Данные шапки сайта
  const [heroSettings, setHeroSettings] = useState({
    hero_title: 'Full-stack Developer',
    hero_subtitle: 'Разрабатываю высоконагруженные CRM-системы, веб-сервисы с Realtime-синхронизацией и масштабируемой архитектурой.',
    telegram_url: 'https://t.me/'
  })
const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadedMediaList, setUploadedMediaList] = useState([])
  // Модальные окна
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [lightboxMedia, setLightboxMedia] = useState(null)

  // Режим редактирования проекта (null = добавление нового)
  const [editingProjectId, setEditingProjectId] = useState(null)

  // Поля авторизации
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')

  // Поля формы проекта
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [mediaUrlsInput, setMediaUrlsInput] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    fetchProjects()
    fetchSettings()

    return () => subscription.unsubscribe()
  }, [])

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) console.error('Ошибка загрузки проектов:', error)
    else setProjects(data || [])
  }

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'main')
      .single()

    if (!error && data) {
      setHeroSettings(data)
    }
  }

  // Вход
  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    })
    if (error) alert('Ошибка входа: ' + error.message)
    else setShowAuthModal(false)
  }

  // Выход
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  // Сохранение шапки сайта
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('site_settings')
      .update(heroSettings)
      .eq('id', 'main')

    if (error) {
      alert('Ошибка сохранения настроек: ' + error.message)
    } else {
      setShowSettingsModal(false)
    }
  }

  // Открытие формы для создания нового проекта
  const openNewProjectModal = () => {
    setEditingProjectId(null)
    setTitle('')
    setDescription('')
    setTagsInput('')
    setDemoUrl('')
    setGithubUrl('')
    setMediaUrlsInput('')
    setUploadedMediaList([])
    setShowAddModal(true)
  }

  // Открытие формы для редактирования существующего проекта
  const openEditProjectModal = (proj) => {
    setEditingProjectId(proj.id)
    setTitle(proj.title)
    setDescription(proj.description)
    setTagsInput((proj.tags || []).join(', '))
    setDemoUrl(proj.demo_url || '')
    setGithubUrl(proj.github_url || '')
    setMediaUrlsInput((proj.media_urls || []).join(', '))
    setUploadedMediaList(proj.media_urls || [])
    setShowAddModal(true)
  }

  // Загрузка файлов в Supabase Storage
  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingMedia(true)
    const newUrls = []

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('portfolio-media')
        .upload(filePath, file)

      if (uploadError) {
        alert(`Ошибка загрузки ${file.name}: ${uploadError.message}`)
      } else {
        const { data } = supabase.storage
          .from('portfolio-media')
          .getPublicUrl(filePath)

        if (data?.publicUrl) {
          newUrls.push(data.publicUrl)
        }
      }
    }

    setUploadedMediaList((prev) => [...prev, ...newUrls])
    setUploadingMedia(false)
    e.target.value = '' // сброс инпута
  }

  // Удаление превью из формы
  const handleRemoveMedia = (indexToRemove) => {
    setUploadedMediaList((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  // Сохранение (Создание или Обновление) проекта
  const handleSaveProject = async (e) => {
    e.preventDefault()
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const manualUrls = mediaUrlsInput.split(',').map(m => m.trim()).filter(Boolean)
    
    // Объединяем загруженные через Storage файлы и вручную введенные ссылки без дубликатов
    const media_urls = Array.from(new Set([...uploadedMediaList, ...manualUrls]))

    const payload = {
      title,
      description,
      tags,
      demo_url: demoUrl,
      github_url: githubUrl,
      media_urls
    }

    if (editingProjectId) {
      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', editingProjectId)

      if (error) alert('Ошибка обновления: ' + error.message)
      else {
        setShowAddModal(false)
        fetchProjects()
      }
    } else {
      const { error } = await supabase.from('projects').insert([payload])
      if (error) alert('Ошибка добавления: ' + error.message)
      else {
        setShowAddModal(false)
        fetchProjects()
      }
    }
  }

  // Удаление проекта
  const handleDeleteProject = async (id, projectTitle) => {
    if (window.confirm(`Вы точно хотите удалить проект "${projectTitle}"?`)) {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) alert('Ошибка удаления: ' + error.message)
      else fetchProjects()
    }
  }

  return (
    <div className="container">
      {/* 3D фоновые источники света */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      {/* Hero */}
      <section className="hero">
        <h1>{heroSettings.hero_title}</h1>
        <p>{heroSettings.hero_subtitle}</p>
        <div className="hero-actions">
          <a href="#projects" className="btn btn-primary">Смотреть проекты</a>
          <a href={heroSettings.telegram_url} target="_blank" rel="noreferrer" className="btn btn-outline">
            Написать в Telegram
          </a>
          {session && (
            <button className="btn btn-outline" onClick={() => setShowSettingsModal(true)}>
              ⚙️ Редактировать шапку
            </button>
          )}
        </div>
      </section>

{/* Стек технологий */}
      <section className="skills-section">
        <div className="skills-title">Ключевой стек и инструменты</div>
        <div className="skills-grid">
          <span className="skill-badge">React</span>
          <span className="skill-badge">JavaScript / TypeScript</span>
          <span className="skill-badge">Node.js</span>
          <span className="skill-badge">PostgreSQL</span>
          <span className="skill-badge">Supabase</span>
          <span className="skill-badge">Realtime & WebSockets</span>
          <span className="skill-badge">REST API Architecture</span>
          <span className="skill-badge">Vite</span>
          <span className="skill-badge">Git & GitHub</span>
        </div>
      </section>

      {/* Projects */}
      <section id="projects">
        <div className="section-header">
          <h2 className="section-title">Проекты и кейсы</h2>
          {session && (
            <button className="btn btn-primary" onClick={openNewProjectModal}>
              + Добавить проект
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>Пока нет опубликованных кейсов</h3>
            <p>Войдите в режим админа внизу страницы, чтобы добавить свои первые проекты с демо и скриншотами.</p>
          </div>
        ) : (
          projects.map((proj) => (
            <div key={proj.id} className="project-card">
              <div className="project-header">
                <h3 className="project-title">{proj.title}</h3>
                {session && (
                  <div className="admin-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEditProjectModal(proj)}>
                      ✏️ Править
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProject(proj.id, proj.title)}>
                      🗑️ Удалить
                    </button>
                  </div>
                )}
              </div>

              <p className="project-desc">{proj.description}</p>

              {proj.tags && proj.tags.length > 0 && (
                <div className="tags">
                  {proj.tags.map((tag, idx) => (
                    <span key={idx} className="tag">{tag}</span>
                  ))}
                </div>
              )}

              {/* Карусель медиа в стиле Google Play */}
              {proj.media_urls && proj.media_urls.length > 0 && (
                <div className="gallery-scroll">
                  {proj.media_urls.map((url, i) => {
                    const isVideo = url.endsWith('.mp4') || url.includes('video')
                    return (
                      <div key={i} className="media-item" onClick={() => setLightboxMedia(url)}>
                        {isVideo ? (
                          <video src={url} muted autoPlay loop playsInline />
                        ) : (
                          <img src={url} alt={`Скриншот ${i + 1}`} loading="lazy" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="project-links">
                {proj.demo_url && (
                  <a href={proj.demo_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                    Открыть демо
                  </a>
                )}
                {proj.github_url && (
                  <a href={proj.github_url} target="_blank" rel="noreferrer" className="btn btn-outline">
                    Исходный код (GitHub)
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Footer */}
      <footer>
        <p>© 2026 Personal Portfolio. Все права защищены.</p>
        {!session ? (
          <button className="admin-trigger" onClick={() => setShowAuthModal(true)}>
            • Вход для владельца
          </button>
        ) : (
          <button className="admin-trigger" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
            • Выйти из режима админа
          </button>
        )}
      </footer>

      {/* Модалка добавления / редактирования проекта */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProjectId ? 'Редактировать кейс' : 'Добавить новый кейс'}</h3>
            <form onSubmit={handleSaveProject}>
              <div className="form-group">
                <label>Название проекта</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea rows="4" value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Теги (через запятую: React, Supabase, PostgreSQL)</label>
                <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ссылка на демо (Vercel)</label>
                <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ссылка на GitHub</label>
                <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Медиафайлы (скриншоты и видео)</label>
                
                {/* Дропзона / кнопка загрузки */}
                <div className="file-upload-box">
                  <label className="file-upload-label">
                    {uploadingMedia ? '⏳ Загрузка в облако...' : '📁 Нажмите, чтобы выбрать скриншоты/видео'}
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      disabled={uploadingMedia}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {/* Превью добавленных файлов */}
                {uploadedMediaList.length > 0 && (
                  <div className="upload-previews">
                    {uploadedMediaList.map((url, idx) => {
                      const isVideo = url.endsWith('.mp4') || url.includes('video')
                      return (
                        <div key={idx} className="upload-preview-item">
                          {isVideo ? (
                            <video src={url} muted />
                          ) : (
                            <img src={url} alt="Превью" />
                          )}
                          <button
                            type="button"
                            className="upload-preview-remove"
                            onClick={() => handleRemoveMedia(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <label style={{ marginTop: '8px' }}>Или прямые ссылки (через запятую):</label>
                <textarea
                  rows="2"
                  placeholder="https://.../img1.png, https://.../img2.png"
                  value={mediaUrlsInput}
                  onChange={(e) => setMediaUrlsInput(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowAddModal(false)}
                >
                  Отменить
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {editingProjectId ? 'Сохранить изменения' : 'Опубликовать'}
                </button>
              </div>
          </form>
          </div>
        </div>
      )}

      {/* Модалка настроек текста шапки */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Настройки шапки сайта</h3>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Заголовок (Hero Title)</label>
                <input
                  value={heroSettings.hero_title}
                  onChange={(e) => setHeroSettings({ ...heroSettings, hero_title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Подзаголовок / Описание</label>
                <textarea
                  rows="3"
                  value={heroSettings.hero_subtitle}
                  onChange={(e) => setHeroSettings({ ...heroSettings, hero_subtitle: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ссылка на Telegram</label>
                <input
                  value={heroSettings.telegram_url}
                  onChange={(e) => setHeroSettings({ ...heroSettings, telegram_url: e.target.value })}
                />
              </div>
             <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowSettingsModal(false)}
              >
                Отменить
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Сохранить настройки
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Модалка входа */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Вход владельца</h3>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Пароль</label>
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
              </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowAuthModal(false)}
                >
                  Отменить
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Войти
                </button>
              </div>
          </form>
          </div>
        </div>
      )}

      {/* Lightbox просмотр */}
      {lightboxMedia && (
        <div className="lightbox-overlay" onClick={() => setLightboxMedia(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {lightboxMedia.endsWith('.mp4') || lightboxMedia.includes('video') ? (
              <video src={lightboxMedia} controls autoPlay />
            ) : (
              <img src={lightboxMedia} alt="Увеличенный просмотр" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}