// noinspection JSIgnoredPromiseFromCall

"use client"

import {Fragment, useEffect, useState} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"
import {ChatEvent, ChzzkChat} from "chzzk"

const colors = [
    "rgb(219, 74, 63)",
    "rgb(95, 158, 160)",
    "rgb(218, 165, 32)",
    "rgb(0, 255, 127)",
    "rgb(180, 84, 255)",
    "rgb(30, 144, 255)"
]

const emojiRegex = /{:([a-zA-Z0-9_]+):}/g

function Chat({badges, color, nickname, emojis, message}) {
    const match = message.match(emojiRegex)

    return (
        <div data-from={nickname}>
            <span className="meta" style={{
                color: typeof color == "number" ? colors[color] : color
            }}>
                {badges.map((badge: { name: string, src: string }) => (
                    <img alt={badge.name} key={badge.name} className="badge" src={badge.src}/>
                ))}
                <span className="name">
                    {nickname}
                </span>
                <span className="colon">
                    :
                </span>
            </span>
            <span className="message">
                {match ? (
                    <Fragment>
                        {message.split(emojiRegex).map((part: string, i: number) => {
                            if (i % 2 == 0) {
                                return part
                            } else {
                                const src = emojis[part]
                                return (
                                    <span key={i} className="emote_wrap">
                                        <img alt={`{:${part}:}`} className="emoticon" src={src}/>
                                    </span>
                                )
                            }
                        })}
                    </Fragment>
                ) : message}
            </span>
        </div>
    )
}

export default function ChatBox({chatChannelId, accessToken}) {
    const [chats, setChats] = useState([])

    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    function onChat(chat: ChatEvent) {
        if (chat.hidden) return

        const id = `${chat.profile.userIdHash}-${chat.time}`
        const nickname = chat.profile.nickname
        const badge = chat.profile.badge ? {
            name: chat.profile.title.name, src: chat.profile.badge.imageUrl
        } : null
        const badges = (badge ? [badge] : []).concat(
            chat.profile.activityBadges
                .filter(badge => badge.activated)
                .map(badge => ({name: badge.title, src: badge.imageUrl}))
        )
        const color = chat.profile.title?.color ?? nickname.split("")
            .map(c => c.charCodeAt(0))
            .reduce((a, b) => a + b, 0) % colors.length
        const emojis = chat.extras?.emojis || {}
        const message = chat.message

        setChats((prevState) => {
            const newChats = prevState.concat([{
                id,
                badges,
                color,
                nickname,
                emojis,
                message
            }])

            if (newChats.length > 50) {
                newChats.splice(0, newChats.length - 50)
            }

            return newChats
        })
    }

    useEffect(() => {
        const chzzkChat = ChzzkChat.fromAccessToken(chatChannelId, accessToken)
        chzzkChat.on("chat", onChat.bind(this))
        chzzkChat.on("connect", () => chzzkChat.requestRecentChat(50))
        chzzkChat.on("disconnect", () => {
            setChats([])
            chzzkChat.connect()
        })

        chzzkChat.connect()
    }, [])

    useEffect(() => {
        window.scrollTo(0, document.body.scrollHeight)
    }, [chats])

    return (
        <div id="log" className={clsx(small && "small")}>
            {chats.map(chat => <Chat key={chat.id} {...chat}/>)}
        </div>
    )
}